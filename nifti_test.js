
"use strict";
twgl.setDefaults({attribPrefix: "a_"});

var programInfo, VS, FS, VS_rotate, FS_rotate, programInfo_rotate;
var texturesArray = [];
var maskTexturesArray = [];
var drawUniforms = {};

var displayWindow = 256;
var displayLevel = 128;

let views = [];

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
  study.addMaskFromNifti(maskHeaderImagePair[0], maskHeaderImagePair[1], [.5, 0.0, 0.0, .35]);
  study.addDummyMask(0.25, [0.0, .5, 0.0, .35]);

  texturesArray = study.to3DTextures();
  maskTexturesArray = study.masksTo3DTextures();
  seriesUL.innerHTML = masksUL.innerHTML = "";
  for (let i = 0; i < study.series.length; ++i) {
    let s = study.series[i];
    seriesUL.innerHTML += "<li onclick=\"showSeries(" + i + ")\">" + s.name + "</li>";
  }
  for (let i = 0; i < study.masks.length; ++i) {
    let m = study.masks[i];
    masksUL.innerHTML += "<li id=\"mask-" + i + "-li\" onclick=\"showMask(" + i + ")\">" + m.name + "</li>";
  }

  // create 2D views
  views.push(new View2D({scale: .5, xColor: [0, 1, 0, 1], yColor: [1, 0, 0, 1], normal: [0, 0, 1], U: [1, 0, 0], V: [0, 1, 0], study, displayWindow, displayLevel, width: 400, height: 400, x: 0, y: 0}));
  views.push(new View2D({scale: .5, xColor: [0, 0, 1, 1], yColor: [1, 0, 0, 1], normal: [0, 1, 0], U: [1, 0, 0], V: [0, 0, 1], study, displayWindow, displayLevel, width: 400, height: 400, x: 400, y: 400}));
  views.push(new View2D({scale: .5, xColor: [0, 0, 1, 1], yColor: [0, 1, 0, 1], normal: [1, 0, 0], U: [0, 1, 0], V: [0, 0, 1], study, displayWindow, displayLevel, width: 400, height: 400, x: 400, y: 0}));

 // views[0].showMask = false;

  //viewMain.setSeries(seriesIndex);
  //viewMain.setShowMask(false);
  requestAnimationFrame(render);
}

function setupMainDivHTML() {
  let ans = 
  "<head> \
  <link rel=\"stylesheet\" type =\"text/css\" href=\"main.css\"/> \
  </head> \
  <body> \
  <div id=\"container\"> \
    <div id=\"mainPanel\"> \
      <canvas id = \"c\" width=\"800\" height=\"800\"></canvas> \
      <br/> \
      <button onclick=\"resetViews()\">reset views</button> \
    </div> \
    <div id=\"infoPanel\"> \
      <div class=\"seriesList\"> \
        Series: \
        <ul id=\"seriesUL\"> \
          <li> Series 1 </li> \
          <li> Series 2 </li> \
        </ul> \
      </div> \
      <div class=\"masksList\"> \
        Masks:  \
        <ul id=\"masksUL\"> \
          <li> Mask 1 </li> \
          <li> Mask 2 </li> \
        </ul> \
      </div> \
      <div id=\"maskInfo\"> \
      </div> \
    </div> \
  </div> \
  </body>"

  return ans;
}

var mainDiv = document.getElementById("main");
mainDiv.innerHTML = setupMainDivHTML();
var seriesUL = document.getElementById("seriesUL");
var masksUL = document.getElementById("masksUL");

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

var drawArrays_crosshair_X = {
  position: [-1, 0, 0, 1, 0, 0], 
}

var drawArrays_crosshair_Y = {
  position: [0, -1, 0, 0, 1, 0],
} 

var drawBufferInfo = twgl.createBufferInfoFromArrays(gl, drawArrays);
var drawBufferInfo_crosshair_X = twgl.createBufferInfoFromArrays(gl, drawArrays_crosshair_X);
var drawBufferInfo_crosshair_Y = twgl.createBufferInfoFromArrays(gl, drawArrays_crosshair_Y);

var mainXform = m4.identity();
var center = [0, 0, 0];

var niftiData = null;
var maskNiftiData = null;

/*
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
*/

function render(time) {
  time *= 0.0001;

  // drawUniforms.u_tex = texturesArray[seriesIndex];
  // drawUniforms.u_slice = sliceIndex / study.series[seriesIndex].depth;
  // drawUniforms.u_xform = m4.multiply(m4.identity(), m4.translation([0, 0, sliceIndex / study.series[seriesIndex].depth]));

  // console.log(drawUniforms.u_xform);
  // apply mask, maybe.
  

  // twgl.bindFramebufferInfo(gl, updateFBI);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  twgl.resizeCanvasToDisplaySize(gl.canvas);

  drawUniforms.u_screenDim = [gl.canvas.width, gl.canvas.height];

  gl.disable(gl.DEPTH_TEST);
  //gl.enable(gl.CULL_FACE);
  gl.clear(gl.COLOR_BUFFER_BIT);

  
  //gl.enable (gl.BLEND);
  //gl.blendFunc(gl.ONE, gl.ZERO);
  //gl.blendEquationSeparate(gl.FUNC_ADD, gl.MIN);

   
  // Draw views
  for (let view of views) {
    gl.viewport(view.x, view.y, view.width, view.height);

    gl.useProgram(programInfo.program);
    twgl.setBuffersAndAttributes(gl, programInfo, drawBufferInfo);
    
    // set uniforms
    drawUniforms.u_tex = texturesArray[seriesIndex];
    drawUniforms.u_viewportInfo = [view.x, view.y, view.width, view.height];
    drawUniforms.u_voxelDim = view.voxelDim;

    drawUniforms.u_world2voxel = view.world2voxel;
    drawUniforms.u_center = center;
    drawUniforms.u_normal = view.currentNormal;
    drawUniforms.u_U = view.currentU;
    drawUniforms.u_V = view.currentV;
    drawUniforms.u_color = [1, 1, 1, 1];
    //drawUniforms.u_d = view.d;
    drawUniforms.u_scale = view.currentScale;
    //drawUniforms.u_correctionXform = view.correctionXform;

        // Need to re-work exactly how we get the slice.
    
    drawUniforms.u_wl = [view.displayWindow /32768, view.displayLevel/32768];

    twgl.setUniforms(programInfo, drawUniforms);
    twgl.drawBufferInfo(gl, drawBufferInfo, gl.TRIANGLES);

    // draw zero or more masks
   
    gl.enable (gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    //gl.blendEquationSeparate(gl.FUNC_ADD, gl.MIN);
    let maskColors = [[.35, 0, 0, .25],
                      [0, .35, 0, .25]];
    for (let i = 0; i < study.masks.length; i++) {
      if (study.masks[i].show) {
        drawUniforms.u_world2voxel = study.masks[i].world2voxel;
        drawUniforms.u_tex = maskTexturesArray[i];
        drawUniforms.u_color = study.masks[i].color;
        drawUniforms.u_wl = [1, 0.5];
        twgl.setUniforms(programInfo, drawUniforms);
        twgl.drawBufferInfo(gl, drawBufferInfo, gl.TRIANGLES);
      }
    }

    // hard code the three views with attendant colors
    gl.useProgram(programInfo_rotate.program);
    twgl.setBuffersAndAttributes(gl, programInfo_rotate, drawBufferInfo_crosshair_X);
    //let xf = m4.multiply(mainXform, view.xform);

    let mul = 1;
    if (view.angle >= 0) mul = -1;

    let drawUniforms_crosshair = {
      u_dxdy: view.dxdy,
      u_cs: [mul*Math.cos(-view.chAngle), mul*Math.sin(-view.chAngle)],
      u_viewportInfo: [view.x, view.y, view.width, view.height],
      u_lineColor: view.xColor,
    };

    twgl.setUniforms(programInfo_rotate, drawUniforms_crosshair);
    twgl.drawBufferInfo(gl, drawBufferInfo_crosshair_X, gl.LINES);

    twgl.setBuffersAndAttributes(gl, programInfo_rotate, drawBufferInfo_crosshair_Y);
    drawUniforms_crosshair.u_lineColor = view.yColor;
    twgl.setUniforms(programInfo_rotate, drawUniforms_crosshair);
    twgl.drawBufferInfo(gl, drawBufferInfo_crosshair_Y, gl.LINES);

  }

  requestAnimationFrame(render);
}

function checkLoaded() {
  stuffToLoad--;
  console.log(stuffToLoad);
  if (stuffToLoad == 0) launch();
}


// Loading code:
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
