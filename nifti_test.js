
"use strict";
twgl.setDefaults({attribPrefix: "a_"});

var programInfo, VS, FS;

var mouseInfo = {
    lastPos: {x: 0.0, y: 0.0},
    curPos: {x: 0.0, y: 0.0},
    buttonDown: [false, false, false],
};

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

let viewMain = null;
let viewSag = null;
let viewCor = null;


function launch() {
  // called after all image files and shaders are loaded
  programInfo = twgl.createProgramInfo(gl, [VS, FS]);
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
  viewMain = new View2D({xform: xf, study, displayWindow, displayLevel, width: 512, height: 512, x: 0, y: 0});
  xf = m4.identity();
  m4.axisRotate(xf, [1, 0, 0], Math.PI/2.0, xf);
  viewSag = new View2D({xform: xf, study, displayWindow, displayLevel, width: 256, height: 256, x: 512, y: 256});
  xf = m4.identity();
  m4.axisRotate(xf, [0, 1, 0], Math.PI/-2.0, xf);
  let xf2 = m4.axisRotate(m4.identity(), [0, 0, 1], Math.PI/-2.0);
  m4.multiply(xf, xf2, xf);
  //m4.axisRotate(xf, [0, 0, 1], Math.PI/4.0, xf);
  //xf = m4.identity();
  viewCor = new View2D({xform: xf, study, displayWindow, displayLevel, width: 256, height: 256, x: 512, y: 0});

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

  // Draw main view
  gl.viewport(viewMain.x, viewMain.y, viewMain.width, viewMain.height);

  gl.useProgram(programInfo.program);
  twgl.setBuffersAndAttributes(gl, programInfo, drawBufferInfo);
  
  // set uniforms
  drawUniforms.u_tex = texturesArray[viewMain.seriesIndex];
  drawUniforms.u_viewportInfo = [viewMain.x, viewMain.y, viewMain.width, viewMain.height];
  drawUniforms.u_voxelDim = viewMain.voxelDim;
  drawUniforms.u_world2voxel = viewMain.getWorld2Voxel();
  if (viewMain.showMask) {
    drawUniforms.u_maskTex = maskTexturesArray[viewMain.seriesIndex];
    drawUniforms.u_maskAlpha = 1.0;
  }
  else {
    drawUniforms.u_maskTex = noMaskTexture;
    drawUniforms.u_maskAlpha = 0.0;
  }
  drawUniforms.u_wl = [viewMain.displayWindow /32768, viewMain.displayLevel/32768];

 let test_vec = m4.transformPoint(drawUniforms.u_world2voxel, [-80, -80, 0]);
 let test_vec2 = m4.transformPoint(viewMain.voxel2world, [0, 0, 0]);

  twgl.setUniforms(programInfo, drawUniforms);
  twgl.drawBufferInfo(gl, drawBufferInfo, gl.TRIANGLES);

  // Draw coronal view
  gl.viewport(viewCor.x, viewCor.y, viewCor.width, viewCor.height);
  //drawUniforms.u_xform = m4.axisRotate(m4.identity(), [1, 0, 0], Math.PI / -2.0);
  //drawUniforms.u_xform = m4.axisRotate(drawUniforms.u_xform, [0, 0, 1], Math.PI / 2.0);
  drawUniforms.u_tex = texturesArray[viewCor.seriesIndex];
  drawUniforms.u_viewportInfo = [viewCor.x, viewCor.y, viewCor.width, viewCor.height];
  drawUniforms.u_voxelDim = viewCor.voxelDim;
  drawUniforms.u_world2voxel = viewCor.getWorld2Voxel();


  if (viewCor.showMask) {
    drawUniforms.u_maskTex = maskTexturesArray[viewCor.seriesIndex];
    drawUniforms.u_maskAlpha = 1.0;
  }
  else {
    drawUniforms.u_maskTex = noMaskTexture;
    drawUniforms.u_maskAlpha = 0.0;
  }
  drawUniforms.u_wl = [viewCor.displayWindow /32768, viewCor.displayLevel/32768];
  twgl.setUniforms(programInfo, drawUniforms);
  twgl.drawBufferInfo(gl, drawBufferInfo, gl.TRIANGLES);

  // Draw sagittal view
  gl.viewport(viewSag.x, viewSag.y, viewSag.width, viewSag.height);
  //drawUniforms.u_xform = m4.axisRotate(m4.identity(), [1, 0, 0], Math.PI / -2.0);
  //drawUniforms.u_xform = m4.axisRotate(drawUniforms.u_xform, [0, 0, 1], Math.PI / 2.0);
  drawUniforms.u_tex = texturesArray[viewSag.seriesIndex];
  drawUniforms.u_viewportInfo = [viewSag.x, viewSag.y, viewSag.width, viewSag.height];
  drawUniforms.u_voxelDim = viewSag.voxelDim;
  drawUniforms.u_world2voxel = viewSag.getWorld2Voxel();
  if (viewSag.showMask) {
    drawUniforms.u_maskTex = maskTexturesArray[viewSag.seriesIndex];
    drawUniforms.u_maskAlpha = 1.0;
  }
  else {
    drawUniforms.u_maskTex = noMaskTexture;
    drawUniforms.u_maskAlpha = 0.0;
  }
  drawUniforms.u_wl = [viewSag.displayWindow /32768, viewSag.displayLevel/32768];
  twgl.setUniforms(programInfo, drawUniforms);
  twgl.drawBufferInfo(gl, drawBufferInfo, gl.TRIANGLES);

  requestAnimationFrame(render);
}

function checkLoaded() {
  stuffToLoad--;
  console.log(stuffToLoad);
  if (stuffToLoad == 0) launch();
}

var niftiData = null;
var maskNiftiData = null;

var stuffToLoad = 4; 
loadURL("VS.glsl", function(xhttp) {VS = xhttp.responseText; checkLoaded();});
loadURL("FS.glsl", function(xhttp) {FS = xhttp.responseText; checkLoaded();});
loadFile("r_TCGA-30-1-FLAIR-1-M.nii.gz", function(result) {niftiData = result; checkLoaded();});
loadFile("mask_wholetumor_3d.nii.gz", function(result) {maskNiftiData = result; checkLoaded();});

// Event handlers below

function mapMouseToUnitPlane(sx, sy) {
    var rect = gl.canvas.getBoundingClientRect();
    return [2.0*((sx-rect.left) / gl.canvas.width)-1.0, 2.0*((rect.top-sy)/ gl.canvas.height)+1.0];
}

var activeView = viewMain;

function getActiveView(event) {
  let ans = null;
  if (event.clientX > 0 && event.clientX < 512) {
    ans = viewMain;
  }
  else if (event.clientY < 256) {
    ans = viewSag;
  }
  else {
    ans = viewCor;
  }
  return ans;
}

function handleMouseWheel(event) {
  event = event || window.event;
  console.log("Wheel");
  activeView = getActiveView(event);
  if (event.deltaY > 0) {
    activeView.scroll(3);
  }
  else {
    activeView.scroll(-3);
  }
  console.log(activeView.xform[14]);
  event.preventDefault();
  event.stopPropagation();
}

function handleMouseMove(event) {
  var dot, eventDoc, doc, body, pageX, pageY;

  event = event || window.event; // IE-ism
  activeView = getActiveView(event);
  // If pageX/Y aren't available and clientX/Y are,
  // calculate pageX/Y - logic taken from jQuery.
  // (This is to support old IE)
  if (event.pageX == null && event.clientX != null) {
      eventDoc = (event.target && event.target.ownerDocument) || document;
      doc = eventDoc.documentElement;
      body = eventDoc.body;

      event.pageX = event.clientX +
        (doc && doc.scrollLeft || body && body.scrollLeft || 0) -
        (doc && doc.clientLeft || body && body.clientLeft || 0);
      event.pageY = event.clientY +
        (doc && doc.scrollTop  || body && body.scrollTop  || 0) -
        (doc && doc.clientTop  || body && body.clientTop  || 0 );
  }

  // Use event.pageX / event.pageY here
  mouseInfo.lastPos.x = mouseInfo.curPos.x;
  mouseInfo.lastPos.y = mouseInfo.curPos.y;
  mouseInfo.curPos.x = event.clientX;
  mouseInfo.curPos.y = event.clientY;
  if (mouseInfo.buttonDown[0] == true) { // left button pressed
      var dx = mouseInfo.curPos.x - mouseInfo.lastPos.x;
      var dy = mouseInfo.curPos.y - mouseInfo.lastPos.y;
      activeView.displayWindow += dx;
      activeView.displayLevel += dy;
      console.log("w: " + activeView.displayWindow + "\tl: " + activeView.displayLevel);
  }
  event.preventDefault();
  event.stopPropagation();
  //console.log(mousePosition);
}

function handleMouseDown(event) {
  event = event || window.event; // IE-ism
  activeView = getActiveView(event);
  mouseInfo.buttonDown[event.button] = true;
  console.log("Button " + event.button + " pressed.");
  if (event.button == 2) {
    activeView.showMask = !activeView.showMask;
  }
  event.preventDefault();
  event.stopPropagation();
  //console.log(updateUniforms.center);
}

function handleMouseUp(event) {
  event = event || window.event; // IE-ism

  mouseInfo.buttonDown[event.button] = false;
  console.log("Button " + event.button + " released.");


  //console.log(updateUniforms.center);
  event.preventDefault();
  if (event.stopPropagation) {
      event.stopPropagation();
  }
  else {
      event.cancelBubble = true;
  }
}

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
