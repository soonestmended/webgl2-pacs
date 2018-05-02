function isTypedArray(obj) {
    return !!obj && obj.byteLength !== undefined;
}

/*
function flattenArrayOfArrays(input) {
  if (!isTypedArray(input[0])) return input;

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
*/

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
  constructor({unitsString = "", width = 0, height = 0, depth = 0, voxelWidth = 0, voxelHeight = 0, voxelDepth = 0, name = "empty", imgData = null, voxel2world = null} = {}) {
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.voxelWidth = voxelWidth;
    this.voxelHeight = voxelHeight;
    this.voxelDepth = voxelDepth;
    this.voxelVolume = voxelWidth * voxelHeight * voxelDepth * .001; // convert to cc
    this.name = name;
    this.imgData = imgData;
    this.mask = null;
    this.voxel2world = voxel2world;
    this.unitsString = unitsString;
    if (this.voxel2world) this.world2voxel = m4.inverse(this.voxel2world);
  }
}

class Mask extends Series {
  constructor(options = {}) {
    super(options);
    this.color = options.color === undefined ? [1, 0, 0, .5] : options.color;
    this.totalVoxels = this.width * this.height * this.depth;
    this.maskedVoxels = this.countPositiveVoxels();
    this.show = false;
    this.voxelDim = [this.width, this.height, this.depth];
    this.id = options.id;
  }

  countPositiveVoxels() {
    let ans = 0;
    for (let i = 0; i < this.imgData.length; ++i) 
        if (this.imgData[i] > 0) ans++;
    return ans;
  }

  contains(p) {
    let mcvx = m4.transformPoint(this.world2voxel, p); // mask coordinates in voxel space
    mcvx[0] = Math.round(mcvx[0]);
    mcvx[1] = Math.round(mcvx[1]);
    mcvx[2] = Math.round(mcvx[2]);
    //console.log(mcvx);
    let mcidx = mcvx[2]*this.width*this.height+mcvx[1]*this.width+mcvx[0];
    //console.log(mcidx);
    return this.imgData[mcidx] > 0;
  }

  volumeInCC() {
    return this.maskedVoxels * this.voxelVolumeInCC();
  }

  voxelVolumeInCC() {
    return this.voxelWidth * this.voxelHeight * this.voxelDepth * .001;
  }
}

class Study {
  constructor(argmap) {
    if (argmap.get('type') == 'nifti') {
      this.initFromNiftis(argmap);
    }
    this.numMasks = 0;
    this.activeMasks = new Uint32Array(1);
    this.activeMasks[0] = 0;
    this.maskOverlapCache = new Map();
  }

  maskVoxelVolumeInCC() {
    return this.maskVoxelWidth * this.maskVoxelHeight * this.maskVoxelDepth * .001;
  }

  initFromNiftis(argmap) {
    let nHeaders = argmap.get('headers');  // array of headers from the nifti files
    let nImages = argmap.get('imageData'); // array of image data from the nifti files

    this.series = []; 
    this.masks = [];

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

      let imageDataAsFloats = new Float32Array(w*h*d);
      let loadedImageData = new Int16Array(nImages[i]);

      for (let k = 0; k < d; ++k) { // loop over image
        for (let j = 0 ; j < h; ++j) {
          for (let ii = 0; ii < w; ++ii) {
            let index = k*w*h+j*w+ii;
            imageDataAsFloats[index] = loadedImageData[index] / 32768;
          }
        }
      }


      //  let sliceSize = w * h * (header.numBitsPerVoxel/8);
      //  loadedImages.push(new Int16Array(nImages[i].slice(j*sliceSize, (j+1)*sliceSize)));
      
      let unitsString = header.getUnitsCodeString(header.xyzt_units & 7);
      if (unitsString == "millimeters") unitsString = "mm";
      this.series.push(new Series({units: unitsString, width: w, height: h, depth: d, voxelWidth: vWidth, voxelHeight: vHeight, voxelDepth: vDepth, name: header.description, imgData: imageDataAsFloats, voxel2world: xform}));

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



  addDummyMask(condition, c) {
    let w, h, d, idx;
    //let box = new BBox(llc, urc);
    w = h = d = 256;
    let maskData = new Float32Array(w*h*d);
    let x, y, z;
    for (let k = 0; k < d; k++) {
      z = 2 * (k / d) - 1;
      for (let j = 0; j < h; j++) {
        y = 2 * (j / h) - 1;
        for (let i = 0; i < w; i++) {
          x = 2 * (i / w) -1;
          idx = k*w*h + j*w + i;
          if (condition([x,y,z])) 
            maskData[idx] = 1;
          else 
            maskData[idx] = 0;
        }
      }
    }
    // now compute matrix to scale mask to bounding box of study
    let bboxDim = this.bbox.dim();
    let v2w = this.scaleUnitMaskToBBox([w, h, d], bboxDim);
    //m4.translate(v2w, [-bboxDimCopy[0]/2, -bboxDimCopy[1]/2, -bboxDimCopy[2]/2], v2w);
    //m4.setTranslation(v2w, [-450, -120, -75], v2w);

    // now push mask with those characteristics
    
    this.masks.push(new Mask({id: this.numMasks, units: "mm", color: c, width: w, height: h, depth: d, name: "dummy mask", imgData: maskData, voxelWidth: bboxDim[0]/w, voxelHeight: bboxDim[1]/h, voxelDepth: bboxDim[2]/d, voxel2world: v2w}));
    this.numMasks++;
  }

  addDummyMaskBox(llc, urc, c) {
    let box = new BBox(llc, urc);
    this.addDummyMask(function(point) {return box.contains(point);}, c);
  }

  addDummyMaskSphere(radius, c) {
    this.addDummyMask(function(point) {return point[0]*point[0]+point[1]*point[1]+point[2]*point[2] < radius;}, c);
  }

  scaleUnitMaskToBBox(maskDim, bboxDim) {
    //let bbdc = bboxDim.slice();
    let w = maskDim[0];
    let h = maskDim[1];
    let d = maskDim[2];
    //bboxDim[0] /= w;
    //bboxDim[1] /= h;
    //bboxDim[2] /= d;
    //let scaleMatrix = m4.scaling(bboxDim);
    //let transMatrix = m4.translation([-w/2, -h/2, -d/2]);
    //let v2w = m4.multiply(scaleMatrix, transMatrix);
    let w2v = m4.scaling([w/bboxDim[0], h/bboxDim[1], d/bboxDim[2]]);
    w2v = m4.multiply(m4.translation([w/2, h/2, d/2]), w2v);
    return m4.inverse(w2v);
  }

  addMaskFromNifti(maskHeader, maskData, c) {
    // mask is an array of images with matching depth
//    if (seriesIndex >= this.series.length) {
//      console.log("Adding mask failed -- series " + seriesIndex + " doesn't exist.");
//      return;
//    } 
//    var s = this.series[seriesIndex];
    var w = maskHeader.dims[1];
    var h = maskHeader.dims[2];
    var d = maskHeader.dims[3];
    let vWidth = maskHeader.pixDims[1];
    let vHeight = maskHeader.pixDims[2];
    let vDepth = maskHeader.pixDims[3];
//    if (s.width != w || s.height != h || s.depth != d) {
//      console.log("Adding mask failed -- mask dimensions don't match series dimensions.");
//      return;
//    }
//    this.mask = new Map();

    let imageDataAsFloats = new Float32Array(w*h*d);
    let loadedImageData = new Int16Array(maskData);

    for (let k = 0; k < d; ++k) { // loop over image
      for (let j = 0 ; j < h; ++j) {
        for (let ii = 0; ii < w; ++ii) {
          let index = k*w*h+j*w+ii;
          imageDataAsFloats[index] = loadedImageData[index] > 0 ? 1 : 0;
        }
      }
    }

    // transformation matrix from voxel space to world space (I think)
    let xform = m4.identity();

    // twgl stores matrices in column major order
    xform[0] =  maskHeader.affine[0][0];
    xform[1] =  maskHeader.affine[1][0];
    xform[2] =  maskHeader.affine[2][0];

    xform[4] =  maskHeader.affine[0][1];
    xform[5] =  maskHeader.affine[1][1];
    xform[6] =  maskHeader.affine[2][1];

    xform[8] =  maskHeader.affine[0][2];
    xform[9] =  maskHeader.affine[1][2];
    xform[10] = maskHeader.affine[2][2];

    xform[12] = maskHeader.affine[0][3];
    xform[13] = maskHeader.affine[1][3];
    xform[14] = maskHeader.affine[2][3];

    let unitsString = maskHeader.getUnitsCodeString(maskHeader.xyzt_units & 7);
    if (unitsString == "millimeters") unitsString = "mm";

    this.masks.push(new Mask({id: this.numMasks, units: unitsString, color: c, width: w, height: h, depth: d, name: maskHeader.description, imgData: imageDataAsFloats, voxelWidth: vWidth, voxelHeight: vHeight, voxelDepth: vDepth, voxel2world: xform}));
    this.numMasks++;
  }

  masksToOne3DTexture() {
    let w, h, d;
    let x, y, z;
    let llc = this.bbox.llc;
    let bbd = this.bbox.dim();
    w = h = d = 256;
    this.maskVoxelDim = [w, h, d];
    let w2v = m4.scaling([w/bbd[0], h/bbd[1], d/bbd[2]]);
    this.maskWorld2voxel = m4.multiply(m4.translation([w/2, h/2, d/2]), w2v);
    
    this.maskTexData = new Uint32Array(w*h*d);

    this.maskVoxelWidth = bbd[0] / w;
    this.maskVoxelHeight = bbd[1] / h;
    this.maskVoxelDepth = bbd[2] / d;

    for (let k = 0; k < d; ++k) {
      z = llc[2] + (k*bbd[2]/d);
      for (let j = 0; j < h; ++j) {
        y = llc[1] + (j*bbd[1]/h);
        for (let i = 0; i < w; ++i) {
          x = llc[0] + (i*bbd[0]/w);
          let idx = k*w*h+j*w+i;
          this.maskTexData[idx] = 0;
          for (let midx = 0; midx < this.masks.length; ++midx) {
            let m = this.masks[midx];
            if (m.contains([x, y, z]))
              this.maskTexData[idx] |= (1 << midx);
          }
        }
      }
    }
    return twgl.createTexture(gl, {
        target: gl.TEXTURE_3D,
        minMag: gl.NEAREST,
        width: w,
        height: h,
        depth: d,
        internalFormat: gl.R32UI,
        format: gl.RED_INTEGER,
        type: gl.UNSIGNED_INT,
        src: this.maskTexData,
      });
  }

  masksTo3DTextures() {
    var texArray = [];
    for (var i = 0; i < this.masks.length; ++i) {
      let j = 0;
      let s = this.masks[i];
      //let texData = flattenArrayOfArrays(s.images);
      //let texDataAsFloats = new Float32Array(texData.length);
      //for (let i = 0; i < texData.length; ++i) {
        //texDataAsFloats[i] = texData[i] > 0 ? 1 : 0;
      //}
      texArray.push(twgl.createTexture(gl, {
        target: gl.TEXTURE_3D,
        minMag: gl.NEAREST,
        width: s.width,
        height: s.height,
        depth: s.depth,
        internalFormat: gl.R32F,
        format: gl.RED,
        type: gl.FLOAT,
        src: s.imgData,
      }));
    }
    return texArray;
  }

  masksTo2DTextures() {
    var texArray = [];
    for (var i = 0; i < this.masks.length; ++i) {

      var tex = [];
      var s = this.masks[i];
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
        src: s.imgData,
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

  maskOverlap2(activeMasks) {
    let bboxDim = this.bbox.dim();
    let steps = [32, 32, 32];
    let dx = bboxDim[0] / steps[0];
    let dy = bboxDim[1] / steps[1];
    let dz = bboxDim[2] / steps[2];
    let nov = 0; // number of voxels in every mask
    let nmask = 0; // number of voxels in any mask

    for (let z = this.bbox.llc[2]; z < this.bbox.urc[2]; z+=dz) {
      for (let y = this.bbox.llc[1]; y < this.bbox.urc[1]; y+=dy) {
        for (let x = this.bbox.llc[0]; x < this.bbox.urc[0]; x+=dx) {
          let inNumMasks = 0;
          for (let m of activeMasks) {
            //let mcvx = m4.transformPoint(m.world2voxel, [x, y, z]); // mask coordinates in voxel space
            //let mcidx = Math.round(mcvx[2]*m.width*m.height+mcvx[1]*m.width+mcvx[0]);

            if (m.contains([x, y, z])) {
              inNumMasks++;
            }
          }
          if (inNumMasks > 0) nmask++; // this voxel is in some mask
          if (inNumMasks == activeMasks.length) nov++; // this voxel is in every mask
        }
      }
    }

    return "Overlap: " + nov / nmask; // activeMasks.length + " active masks.";
  }

  maskOverlap(activeMasks) {
    let amIDs = [];
    let selectedMasksBitfield = new Uint32Array(1);
    selectedMasksBitfield[0] = 0;
    for (let m of activeMasks) {
      amIDs.push(m.id);
      selectedMasksBitfield[0] |= (1 << m.id);
    }
    amIDs.sort();
    let maskOverlapCacheKey = "";
    for (let id of amIDs) 
      maskOverlapCacheKey += id;
    let overlapInfo;

    console.log("Mask overlap cache key: " + maskOverlapCacheKey);

    if (this.maskOverlapCache.has(maskOverlapCacheKey)) {
      overlapInfo = this.maskOverlapCache.get(maskOverlapCacheKey);
    }
    else {
      /*
      let bboxDim = this.bbox.dim();
      
      // find smallest mask by volume
      let minVol = 999999999999;
      let totalVol = 0;
      let sm; // smallest mask
      for (let m of activeMasks) {
        let vol = m.volumeInCC(); 
        totalVol += vol;
        if (vol < minVol) {
          minVol = vol;
          sm = m; 
        }
      }

      let nov = 0; // number of voxels overlapping all masks

      for (let k = 0; k < sm.depth; ++k) {
        for (let j = 0; j < sm.height; ++j) {
          for (let i = 0; i < sm.width; ++i) {
            let wc = m4.transformPoint(sm.voxel2world, [i, j, k]);
            let inEveryMask = true;
            for (let m of activeMasks) {
              if (m == sm) {
                if (m.imgData[k*m.width*m.height+j*m.width+i] < 0) {
                  inEveryMask = false;
                  break;
                }
              }
              if (!m.contains(wc)) {
                inEveryMask = false;
                break;
              }
            }
            if (inEveryMask) nov++;
          }
        }
      }
      */

      // VOLUME STUFF ABOVE IS SCREWED UP
      let voxelsInAnyMask = 0;
      let voxelsInSelectedMasks = 0;
      for (let idx = 0; idx < this.maskVoxelDim[0]*this.maskVoxelDim[1]*this.maskVoxelDim[2]; ++idx) {
        let data = this.maskTexData[idx];
        if (data > 0) {
          voxelsInAnyMask++;
          if (data == selectedMasksBitfield[0])
            voxelsInSelectedMasks++;
        }
      }

      overlapInfo = {overlapVolume: voxelsInSelectedMasks*this.maskVoxelVolumeInCC(), totalVolume: voxelsInAnyMask*this.maskVoxelVolumeInCC()};
      this.maskOverlapCache.set(maskOverlapCacheKey,  overlapInfo);
    }
    return "Overlap: " + (100 * overlapInfo.overlapVolume / overlapInfo.totalVolume).toFixed(2) + "% / " + Math.floor(overlapInfo.overlapVolume) + " cc"; 
  }

}