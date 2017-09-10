
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
var drawUniforms;

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

    // now we have the header and the image data. should be able to split the nifti up into slices. for now assume dims[1] = width, dims[2] = height, dims[3] = num slices
    

  }
  else {
    console.log("Not NIFTI data.");
  }
  return [niftiHeader, niftiImage];
}

var displayWindow = 256;
var displayLevel = 128;
var showMask = false;

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

  // create draw uniforms and bufferInfo

  drawUniforms = {
    u_resolution: [gl.canvas.width, gl.canvas.height],
    u_tex: texturesArray[seriesIndex],
    u_wl: [displayWindow, displayLevel],
    u_slice: sliceIndex / study.series[seriesIndex].depth,
    u_maskAlpha: 0.0,
  };

  if (study.mask.has(seriesIndex) && showMask) {
    drawUniforms.u_maskTex = maskTexturesArray[seriesIndex];
  }
  else {
    drawUniforms.u_maskTex = noMaskTexture;
  }

  requestAnimationFrame(render);
}

var v3 = twgl.v3;
var m4 = twgl.m4;
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

  drawUniforms.u_tex = texturesArray[seriesIndex];
  drawUniforms.u_slice = sliceIndex / study.series[seriesIndex].depth;
  console.log(drawUniforms.u_slice);
// apply mask, maybe.
  if (study.mask.has(seriesIndex) && showMask) {
    drawUniforms.u_maskTex = maskTexturesArray[seriesIndex];
    drawUniforms.u_maskAlpha = 1.0;
  }
  else {
    drawUniforms.u_maskTex = noMaskTexture;
    drawUniforms.u_maskAlpha = 0.0;
  }

  drawUniforms.u_wl = [displayWindow /32768, displayLevel/32768];
  
  // twgl.bindFramebufferInfo(gl, updateFBI);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  twgl.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  //gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable (gl.BLEND);
  gl.blendFunc (gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  gl.useProgram(programInfo.program);
  twgl.setBuffersAndAttributes(gl, programInfo, drawBufferInfo);
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

// mouse wheel
(function() {
    document.onmousewheel = handleMouseWheel;
    function handleMouseWheel(event) {
        event = event || window.event;
        if (event.deltaY > 0) {
            sliceIndex+=1;
            if (sliceIndex == study.series[seriesIndex].depth) {
              sliceIndex-=1;
            }
        }
        else {
            sliceIndex-=1;
            if (sliceIndex == -1) {
              sliceIndex++;
            }
        }
        event.preventDefault();
        event.stopPropagation();
    }
})();

// mouse move
(function() {
    document.onmousemove = handleMouseMove;
    function handleMouseMove(event) {
        var dot, eventDoc, doc, body, pageX, pageY;

        event = event || window.event; // IE-ism

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
            displayWindow += dx;
            displayLevel += dy;
            console.log("w: " + displayWindow + "\tl: " + displayLevel);
        }
        event.preventDefault();
        event.stopPropagation();
        //console.log(mousePosition);
    }
})();

// mouse down
(function() {
    document.onmousedown = handleMouseDown;
    function handleMouseDown(event) {
        event = event || window.event; // IE-ism

        mouseInfo.buttonDown[event.button] = true;
        console.log("Button " + event.button + " pressed.");
        if (event.button == 2) {
          showMask = !showMask;
        }
        event.preventDefault();
        event.stopPropagation();
        //console.log(updateUniforms.center);
    }
})();

// mouse up
(function() {
    document.onmouseup = handleMouseUp;
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
