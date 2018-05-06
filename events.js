function mapMouseToUnitPlane(sx, sy) {
    var rect = gl.canvas.getBoundingClientRect();
    return [2.0*((sx-rect.left) / gl.canvas.width)-1.0, 2.0*((rect.top-sy)/ gl.canvas.height)+1.0];
}

var activeView = null;

var mouseInfo = {
    lastPos: {x: 0.0, y: 0.0},
    curPos: {x: 0.0, y: 0.0},
    buttonDown: [false, false, false],
};

function getActiveView(xy) {
  //console.log("x: " + xy[0] + "  y: " + xy[1]);
  for (let view of views) {
    if (view.viewportContains(xy[0], xy[1])) {
      return view;
    }
  }
  return null;
}

function handleMouseWheel(event) {
  event = event || window.event;
  console.log("Wheel");
  activeView = getActiveView(event2canvas(event));
  let dz = 1;
  if (event.deltaY > 0) {
    dz = -1;
  }

  let tv = v3.mulScalar(activeView.currentNormal, dz); 
  v3.add(center, tv, center);
  for (let view of views) {
    view.updateCrosshairPosition(center);
    
  }
  event.preventDefault();
  event.stopPropagation();
}

function event2canvas(e) {
  return client2canvas(e.clientX, e.clientY);
}

function client2canvas(x, y) {
  let rect = gl.canvas.getBoundingClientRect();
  let localX = x - rect.left;
  let localY = gl.canvas.height - (y - rect.top);
  return [localX, localY];
}

  let MODE_MOVE = 0;
  let MODE_ROTATE = 1;
  let MODE_DEFAULT = 2;
  let mode = MODE_DEFAULT;
  // need to deal with not changing modes if button stays held down.

function handleMouseMove(event) {
  var dot, eventDoc, doc, body, pageX, pageY;

  event = event || window.event; // IE-ism
  //activeView = getActiveView(event);
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

  let localXY = event2canvas(event);

  //set cursor
  let overNow = getActiveView(localXY);
  let rect = gl.canvas.getBoundingClientRect();
  
  

    var dx = mouseInfo.curPos.x - mouseInfo.lastPos.x;
    var dy = mouseInfo.curPos.y - mouseInfo.lastPos.y;

  if (mouseInfo.buttonDown[0] == mouseInfo.buttonDown[1] == mouseInfo.buttonDown[2] == false) {
    if (overNow != null && overNow.overMoveCrosshair(localXY[0], localXY[1])) {
      document.body.style.cursor = "move";
      mode = MODE_MOVE;
    }
    else if (overNow != null && overNow.overRotateCrosshair(localXY[0], localXY[1])) {
      document.body.style.cursor = "pointer";
      mode = MODE_ROTATE;
    }

    else {
      document.body.style.cursor = "default";
      mode = MODE_DEFAULT;
    }
  }

  else if (mouseInfo.buttonDown[0] == true && mouseInfo.buttonDown[1] == false && mouseInfo.buttonDown[2] == false) { // left button pressed
      if (mode == MODE_MOVE) {
        
        let tv = v3.add(v3.mulScalar(activeView.currentU, dx * activeView.currentScale), v3.mulScalar(activeView.currentV, -dy * activeView.currentScale)); // crosshair translation in world coordinates
        v3.add(center, tv, center);
        for (let view of views) {
          view.updateCrosshairPosition(center);
        }
        //console.log("Center: " + center);// + " " + study.masks[1].contains(center));
        let mvp = study.transformWorldToMask(center);
        //console.log("Mask voxel position: " + mvp);
        let md = new Uint32Array(1);
        md[0] = study.maskTexData[mvp[2]*study.maskVoxelDim[0]*study.maskVoxelDim[1] + mvp[1]*study.maskVoxelDim[1] + mvp[0]];
        console.log("Mask data: " + md[0]);
        console.log("Selected masks: " + study.activeMasks[0]);
        console.log("Mask data & selected masks: " + (md[0] & study.activeMasks[0]));
      }

      else if (mode == MODE_ROTATE) {
        let dtheta = activeView.rotateCrosshair(localXY, client2canvas(mouseInfo.lastPos.x, mouseInfo.lastPos.y));
        for (let view of views) {
          if (view != activeView) {
            // rotate view.U and view.V dtheta around activeView.normal
            view.rotateImage(activeView.currentNormal, dtheta);
            view.updateCrosshairPosition(center);
          }
        }
      }
  }
  else if (mouseInfo.buttonDown[0] == false && mouseInfo.buttonDown[1] == false && mouseInfo.buttonDown[2] == true) {
    activeView.displayWindow += dx;
    activeView.displayLevel += dy;
    //console.log("w: " + activeView.displayWindow + "\tl: " + activeView.displayLevel);
  }

  else if (mouseInfo.buttonDown[0] == false && mouseInfo.buttonDown[1] == true && mouseInfo.buttonDown[2] == false) {
    // clicked and dragged with middle button
    if (dy < 0) {
      activeView.currentScale /= 1.1;
    } 
    else {
      activeView.currentScale *= 1.1;
    }
    for (view of views) {
      view.updateCrosshairPosition(center);
    }
  }

  event.preventDefault();
  event.stopPropagation();
  //console.log(mousePosition);
}

function handleMouseDown(event) {
  event = event || window.event; // IE-ism
  activeView = getActiveView(event2canvas(event));
  mouseInfo.buttonDown[event.button] = true;
  //console.log("Button " + event.button + " pressed.");
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

function resetViews() {
  center = [0, 0, 0];
  for (let view of views) {
    view.reset();
  }
}

function toCSSColor(c) {
  let b = c.slice();
  for (let i = 0; i < 3; i++) {
    if (b[i] > 0) b[i] = .9;
    else b[i] = .4;
  }

  let ans = "rgb(" + Math.floor(b[0]*255) + ", " + Math.floor(b[1]*255) + ", " + Math.floor(b[2]*255) + ")";

  return ans;
}

function showMask(id) {
  let maskInfo = document.getElementById("maskInfo");
  let maskLI = document.getElementById("mask-"+id+"-li");

  let m = study.masks[id];
  if (m.show) {
    m.show = false;
    study.activeMasks[0] &= ~(1 << id);
    maskLI.style.background = "";
    //study.numActiveMasks--;
  }
  else {
    m.show = true;
    study.activeMasks[0] |= (1 << id);
    maskLI.style.backgroundColor = toCSSColor(m.color);
    //study.numActiveMasks++;
  }
  console.log("study.activeMasks[0] = " + study.activeMasks[0]);

  let activeMasks = [];
  for (let msk of study.masks) {
    if (msk.show) activeMasks.push(msk);

  }
  if (activeMasks.length == 0) {
    maskInfo.innerHTML = "";
    return;
  }
  maskInfo.innerHTML = "Info: ";
  for (let am of activeMasks) {
    maskInfo.innerHTML += 
  "<ul> \
    <li>"+am.name.substring(0, 10)+": " + Math.floor(am.maskedVoxels * am.voxelVolume) + " cc</li> \
  </ul>";
  }
  if (activeMasks.length == 1) return;
  maskInfo.innerHTML += 
  "<br/> \
  <ul> \
    <li>" + study.maskOverlap(activeMasks) + "</li> \
  </ul>";

  
}

function showSeries(id) {
  seriesIndex = id;
}