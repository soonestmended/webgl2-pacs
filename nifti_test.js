
"use strict";
twgl.setDefaults({attribPrefix: "a_"});

var programInfo, VS, FS, VS_rotate, FS_rotate, programInfo_rotate;



function loadURL(url, cb) {
  var xhttp;
  xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
      cb(xhttp);
    }
  };
  xhttp.open("GET", url, true);
  xhttp.send();
}

var texturesArray = [];
var maskTexturesArray = [];
var drawUniforms = {};

function loadFile(filename, cb) {
  var oReq = new XMLHttpRequest();
  oReq.open("GET", filename, true);
  oReq.responseType = "blob";
  oReq.onload = function(oEvent) {
    var blob = oReq.response;
    var fr = new FileReader();
    fr.onload = function() {
      
      console.log("file loaded.");
      console.log(fr.result.byteLength + " bytes.");

      cb(fr.result);
    }
    fr.readAsArrayBuffer(blob);
  }
  oReq.send();
}
/*
class ImageVolume {
  constructor(nHeader, nImage) {
    this.width = nHeader.dims[1];
    this.height = nHeader.dims[2];
    this.numSlices = nHeader.dims[3];
    this.images = [];
    for (var i = 0; i < this.numSlices; i++) {
      var sliceSize = this.width * this.height * (nHeader.numBitsPerVoxel/8);
      this.images.push(new Int16Array(nImage.slice(i*sliceSize, (i+1)*sliceSize)));
    }
  }
}*/

function readNifti(data) {
  var niftiHeader = null, niftiImage = null, niftiExt = null;
  console.log("Data size in readNifti " + data.byteLength);
  if (nifti.isCompressed(data)) {
    console.log("Found compressed data.");
    data = nifti.decompress(data);
  }

  if (nifti.isNIFTI(data)) {
    console.log("Is NIFTI data!");
    niftiHeader = nifti.readHeader(data);
    console.log(niftiHeader.toFormattedString());
    niftiImage = nifti.readImage(niftiHeader, data);

    if (nifti.hasExtension(niftiHeader)) {
      niftiExt = nifti.readExtensionData(niftiHeader, data);
    }
  }
  else {
    console.log("Not NIFTI data.");
  }
  return [niftiHeader, niftiImage];
}

var displayWindow = 256;
var displayLevel = 128;
var showMask = false;

let views = [];

function launch() {
  // called after all image files and shaders are loaded
  programInfo = twgl.createProgramInfo(gl, [VS, FS]);
  programInfo_rotate = twgl.createProgramInfo(gl, [VS_rotate, FS_rotate]);
  var headerImagePair = readNifti(niftiData);
  var argmap = new Map();
  argmap.set('type', 'nifti');
  argmap.set('headers', [headerImagePair[0]]);
  argmap.set('imageData', [headerImagePair[1]]);

  study = new Study(argmap);
  var maskHeaderImagePair = readNifti(maskNiftiData);
  study.addMaskFromNifti(0, maskHeaderImagePair[0], maskHeaderImagePair[1]);

  texturesArray = study.to3DTextures();
  maskTexturesArray = study.maskTo3DTextures();

  // create 2D views
  let xf = m4.scaling([.5, .5, .5]);
  views.push(new View2D({xform: xf, study, displayWindow, displayLevel, width: 512, height: 512, x: 0, y: 0}));
  xf = m4.identity();
  m4.axisRotate(xf, [1, 0, 0], Math.PI/2.0, xf);
  views.push(new View2D({xform: xf, study, displayWindow, displayLevel, width: 256, height: 256, x: 512, y: 256}));
  xf = m4.identity();
  m4.axisRotate(xf, [0, 1, 0], Math.PI/-2.0, xf);
  let xf2 = m4.axisRotate(m4.identity(), [0, 0, 1], Math.PI/-2.0);
  m4.multiply(xf, xf2, xf);
  //m4.axisRotate(xf, [0, 0, 1], Math.PI/4.0, xf);
  //xf = m4.identity();
  views.push(new View2D({xform: xf, study, displayWindow, displayLevel, width: 256, height: 256, x: 512, y: 0}));

  //viewMain.setSeries(seriesIndex);
  //viewMain.setShowMask(false);
/*
  drawUniforms = {
    u_resolution: [gl.canvas.width, gl.canvas.height],
    u_tex: texturesArray[seriesIndex],
    u_wl: [displayWindow, displayLevel],
    u_slice: sliceIndex / study.series[seriesIndex].depth,
    u_maskAlpha: 0.0,
  };
*/
/*
  if (study.mask.has(seriesIndex) && showMask) {
    drawUniforms.u_maskTex = maskTexturesArray[seriesIndex];
  }
  else {
    drawUniforms.u_maskTex = noMaskTexture;
  }
*/

  requestAnimationFrame(render);
}


var gl = document.getElementById("c").getContext("webgl2");

if (!gl) {
  alert("Web GL 2.0 not supported.");
}

if (!gl.getExtension('OES_texture_float_linear')) {
  alert("Linear interpolation of float textures not supported.");
}

var study = null;

var seriesIndex = 0;
var sliceIndex = 0;

var drawArrays = {
  position: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
  texcoord: [0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0],
}

var drawArrays_rotate_X = {
  position: [-1, 0, 0, 1, 0, 0], 
}

// Dummy 1x1x1 mask texture, transparent
var noMaskTexture = twgl.createTexture(gl, {
  target: gl.TEXTURE_3D,
  min: gl.NEAREST,
  mag: gl.NEAREST,
  width: 1,
  height: 1,
  depth: 1,
  internalFormat: gl.R16I,
  format: gl.RED_INTEGER,
  type: gl.SHORT,
  src: [0],
});

var drawBufferInfo = twgl.createBufferInfoFromArrays(gl, drawArrays);
var drawBufferInfo_rotate_X = twgl.createBufferInfoFromArrays(gl, drawArrays_rotate_X)

function render(time) {
  time *= 0.0001;

  // drawUniforms.u_tex = texturesArray[seriesIndex];
  // drawUniforms.u_slice = sliceIndex / study.series[seriesIndex].depth;
  // drawUniforms.u_xform = m4.multiply(m4.identity(), m4.translation([0, 0, sliceIndex / study.series[seriesIndex].depth]));

  // console.log(drawUniforms.u_xform);
  // apply mask, maybe.
  
/*
  if (study.mask.has(seriesIndex) && showMask) {
    drawUniforms.u_maskTex = maskTexturesArray[seriesIndex];
    drawUniforms.u_maskAlpha = 1.0;
  }
  else {
    drawUniforms.u_maskTex = noMaskTexture;
    drawUniforms.u_maskAlpha = 0.0;
  }

  drawUniforms.u_wl = [displayWindow /32768, displayLevel/32768];
*/  
  // twgl.bindFramebufferInfo(gl, updateFBI);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  twgl.resizeCanvasToDisplaySize(gl.canvas);

  drawUniforms.u_screenDim = [gl.canvas.width, gl.canvas.height];

  //gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable (gl.BLEND);
  gl.blendFunc (gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Draw views
  for (let view of views) {
    gl.viewport(view.x, view.y, view.width, view.height);

    gl.useProgram(programInfo.program);
    twgl.setBuffersAndAttributes(gl, programInfo, drawBufferInfo);
    
    // set uniforms
    drawUniforms.u_tex = texturesArray[view.seriesIndex];
    drawUniforms.u_viewportInfo = [view.x, view.y, view.width, view.height];
    drawUniforms.u_voxelDim = view.voxelDim;
    drawUniforms.u_world2voxel = view.getWorld2Voxel();
    if (view.showMask) {
      drawUniforms.u_maskTex = maskTexturesArray[view.seriesIndex];
      drawUniforms.u_maskAlpha = 1.0;
    }
    else {
      drawUniforms.u_maskTex = noMaskTexture;
      drawUniforms.u_maskAlpha = 0.0;
    }
    drawUniforms.u_wl = [view.displayWindow /32768, view.displayLevel/32768];

    twgl.setUniforms(programInfo, drawUniforms);
    twgl.drawBufferInfo(gl, drawBufferInfo, gl.TRIANGLES);


    gl.useProgram(programInfo_rotate.program);
    twgl.setBuffersAndAttributes(gl, programInfo_rotate, drawBufferInfo_rotate_X);
    let ixf = m4.inverse(view.xform);
    let drawUniforms_rotate = {
      u_dxdy: view.dxdy,
      u_viewportInfo: [view.x, view.y, view.width, view.height],
    };
    twgl.setUniforms(programInfo_rotate, drawUniforms_rotate);

    twgl.drawBufferInfo(gl, drawBufferInfo_rotate_X, gl.LINES);
    

  }

  requestAnimationFrame(render);
}

function checkLoaded() {
  stuffToLoad--;
  console.log(stuffToLoad);
  if (stuffToLoad == 0) launch();
}

var niftiData = null;
var maskNiftiData = null;

var stuffToLoad = 6; 
loadURL("VS_main.glsl", function(xhttp) {VS = xhttp.responseText; checkLoaded();});
loadURL("FS_main.glsl", function(xhttp) {FS = xhttp.responseText; checkLoaded();});
loadURL("VS_rotate.glsl", function(xhttp) {VS_rotate = xhttp.responseText; checkLoaded();});
loadURL("FS_rotate.glsl", function(xhttp) {FS_rotate = xhttp.responseText; checkLoaded();});
loadFile("r_TCGA-30-1-FLAIR-1-M.nii.gz", function(result) {niftiData = result; checkLoaded();});
loadFile("mask_wholetumor_3d.nii.gz", function(result) {maskNiftiData = result; checkLoaded();});

// Event handlers below



// mouse wheel
(function() {
    document.onmousewheel = handleMouseWheel;
})();

// mouse move
(function() {
    document.onmousemove = handleMouseMove;
    
})();

// mouse down
(function() {
    document.onmousedown = handleMouseDown;
    
})();

// mouse up
(function() {
    document.onmouseup = handleMouseUp;
    
})();

// contextmenu
(function() {
    gl.canvas.oncontextmenu = blockContextMenu;
    function blockContextMenu(event) {
        console.log("blockContextMenu");
        event.preventDefault();
        event.stopPropagation();
    }
})();

function stopEvents(ev) {
    ev.stopPropagation();
}
