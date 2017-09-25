function flatten(input) {
  var ans = [];
  var inputLength = input.length;
  for (var i = 0; i < inputLength; ++i) {
    var current = input[i];
    var currentLength = current.length;
    for (var j = 0; j < currentLength; ++j)
      ans.push(current[j]);
  }
  return ans;
}

class BBox {
  constructor(llc, urc) {
    this.llc = llc;
    this.urc = urc;
  }

  contains(point) {
    for (let i = 0; i < 3; ++i) {
      if (point[i] < this.llc[i] || point[i] > this.urc[i]) return false;
    }
    return true;
  }

  dim() {
    return [this.urc[0] - this.llc[0], this.urc[1] - this.llc[1], this.urc[2] - this.llc[2]];
  }
}

class Series {
  // NOTE: each series will have a world space bounding box determined by width * voxelWidth, height * voxelHeight, depth * voxelDepth and its transformation matrix.
  constructor({width = 0, height = 0, depth = 0, voxelWidth = 0, voxelHeight = 0, voxelDepth = 0, name = "empty", images = null, voxel2world = null} = {}) {
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.voxelWidth = voxelWidth;
    this.voxelHeight = voxelHeight;
    this.voxelDepth = voxelDepth;
    this.name = name;
    this.images = images;
    this.mask = null;
    this.voxel2world = voxel2world;
    if (this.voxel2world) this.world2voxel = m4.inverse(this.voxel2world);
  }
}

class Study {
  constructor(argmap) {
    if (argmap.get('type') == 'nifti') {
      this.initFromNiftis(argmap);
    }
  }

  initFromNiftis(argmap) {
    let nHeaders = argmap.get('headers');  // array of headers from the nifti files
    let nImages = argmap.get('imageData'); // array of image data from the nifti files

    this.series = []; 

    let N = nHeaders.length;

    for (let i = 0; i < N; ++i) { // loop over nifti pairs
      let loadedImages = [];
      let header = nHeaders[i];
      
      // number of voxels in each dimension
      let w = header.dims[1];
      let h = header.dims[2];
      let d = header.dims[3];

      // size of each voxel
      let vWidth = header.pixDims[1];
      let vHeight = header.pixDims[2];
      let vDepth = header.pixDims[3];

      // transformation matrix from voxel space to world space (I think)
      let xform = m4.identity();

      // twgl stores matrices in column major order
      xform[0] =  header.affine[0][0];
      xform[1] =  header.affine[1][0];
      xform[2] =  header.affine[2][0];

      xform[4] =  header.affine[0][1];
      xform[5] =  header.affine[1][1];
      xform[6] =  header.affine[2][1];

      xform[8] =  header.affine[0][2];
      xform[9] =  header.affine[1][2];
      xform[10] = header.affine[2][2];

      xform[12] = header.affine[0][3];
      xform[13] = header.affine[1][3];
      xform[14] = header.affine[2][3];


      for (let j = 0; j < d; j++) { // loop over image
        let sliceSize = w * h * (header.numBitsPerVoxel/8);
        loadedImages.push(new Int16Array(nImages[i].slice(j*sliceSize, (j+1)*sliceSize)));
      }

      this.series.push(new Series({width: w, height: h, depth: d, voxelWidth: vWidth, voxelHeight: vHeight, voxelDepth: vDepth, name: header.description, images: loadedImages, voxel2world: xform}));

    }

    // figure out the bounding box for the whole study volume. For this we have to make a bounding box for each series and then enclose all of those in one big bounding box.
    let minLLC = [999999, 999999, 999999];
    let maxURC = [-999999, -999999, -999999];
    for (let i = 0; i < N; ++i) {
      // compute bounding box for series i
      let s = this.series[i];
      let llc = [0.0, 0.0, 0.0];
      let urc = [s.width, s.height, s.depth];
      m4.transformPoint(s.voxel2world, llc, llc);
      m4.transformPoint(s.voxel2world, urc, urc);

      minLLC[0] = Math.min(llc[0], urc[0], minLLC[0]);
      minLLC[1] = Math.min(llc[1], urc[1], minLLC[1]);
      minLLC[2] = Math.min(llc[2], urc[2], minLLC[2]);

      maxURC[0] = Math.max(llc[0], urc[0], maxURC[0]);
      maxURC[1] = Math.max(llc[1], urc[1], maxURC[1]);
      maxURC[2] = Math.max(llc[2], urc[2], maxURC[2]);

    }
    this.bbox = new BBox(minLLC, maxURC);
    console.log("Bounding box: " + this.bbox);

  }

  addMaskFromNifti(seriesIndex, maskHeader, maskData) {
    // mask is an array of images with matching depth
    if (seriesIndex >= this.series.length) {
      console.log("Adding mask failed -- series " + seriesIndex + " doesn't exist.");
      return;
    } 
    var s = this.series[seriesIndex];
    var w = maskHeader.dims[1];
    var h = maskHeader.dims[2];
    var d = maskHeader.dims[3];
    let vWidth = maskHeader.pixDims[1];
    let vHeight = maskHeader.pixDims[2];
    let vDepth = maskHeader.pixDims[3];
    if (s.width != w || s.height != h || s.depth != d) {
      console.log("Adding mask failed -- mask dimensions don't match series dimensions.");
      return;
    }
    this.mask = new Map();

    var loadedImages = [];
    for (var j = 0; j < d; j++) { // loop over image
      var sliceSize = w * h * (maskHeader.numBitsPerVoxel/8);
      loadedImages.push(new Int16Array(maskData.slice(j*sliceSize, (j+1)*sliceSize)));
    }
    this.mask.set(seriesIndex, new Series({width: w, height: h, depth: d, name: maskHeader.description, images: loadedImages, voxelWidth: vWidth, voxelHeight: vHeight, voxelDepth: vDepth}));
  }

  maskTo3DTextures() {
    var texArray = [];
    for (var i = 0; i < this.series.length; ++i) {
      if (!this.mask.has(i)) {
        texArray.push(null);
        continue;
      }
      var s = this.mask.get(i);
      var texData = flatten(s.images);
      texArray.push(twgl.createTexture(gl, {
        target: gl.TEXTURE_3D,
        minMag: gl.NEAREST,
        width: s.width,
        height: s.height,
        depth: s.depth,
        internalFormat: gl.R16I,
        format: gl.RED_INTEGER,
        type: gl.SHORT,
        src: texData,
      }));
    }
    return texArray;
  }

  maskTo2DTextures() {
    var texArray = [];
    for (var i = 0; i < this.series.length; ++i) {
      if (!this.mask.has(i)) {
        texArray.push(null);
        continue;
      }
      var tex = [];
      var s = this.mask.get(i);
      for (let img of s.images) {
        var texData = twgl.primitives.createAugmentedTypedArray(4, s.width * s.height); // Default Float32 array
        if (img instanceof Int16Array) {
          for (var j = 0; j < s.width * s.height; j++) {
            // convert signed short to float
            var fv = img[j];
            texData.push([fv*.2, fv*.2, fv, fv*0.25]);
          }
        }
        tex.push(twgl.createTexture(gl, {
          min: gl.NEAREST,
          mag: gl.NEAREST,
          width: s.width,
          height: s.height,
          src: texData,
        }));
      }
      texArray.push(tex);
    }
    return texArray;
  }

  to3DTextures() {
    var texArray = [];
    for (let s of this.series) {
      var texData = flatten(s.images);
      var texDataAsFloats = new Float32Array(texData.length);
      for (var i = 0; i < texData.length; ++i) {
        texDataAsFloats[i] = texData[i] /32768;
      }
      
      texArray.push(twgl.createTexture(gl, {
        target: gl.TEXTURE_3D,
        min: gl.LINEAR,
        mag: gl.LINEAR,
        width: s.width,
        height: s.height,
        depth: s.depth,
        internalFormat: gl.R32F,
        format: gl.RED,
        type: gl.FLOAT,
        wrap: gl.CLAMP_TO_EDGE,
        src: texDataAsFloats,
      }));
    }
    return texArray;
  }

  to2DTextures() {
    var texArray = [];
    for (let s of this.series) {
      var tex = [];
      for (let img of s.images) {
        var texData = twgl.primitives.createAugmentedTypedArray(4, s.width * s.height); // Default Float32 array
        if (img instanceof Int16Array) {
          for (var i = 0; i < s.width * s.height; i++) {
            // convert signed short to float
            var fv = (img[i] + 32768.) / 65536.;
            texData.push([fv, fv, fv, 1.0]);
          }
        }
        tex.push(twgl.createTexture(gl, {
          min: gl.NEAREST,
          mag: gl.NEAREST,
          width: s.width,
          height: s.height,
          src: texData,
        }));
      }
      texArray.push(tex);
    }
    return texArray;
  }

}