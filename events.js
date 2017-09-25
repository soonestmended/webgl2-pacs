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
  console.log("x: " + xy[0] + "  y: " + xy[1]);
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

  let tv = v3.mulScalar(activeView.normal, dz); 
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
        
        let tv = v3.add(v3.mulScalar(activeView.U, dx * activeView.scale), v3.mulScalar(activeView.V, -dy * activeView.scale)); // crosshair translation in world coordinates
        v3.add(center, tv, center);
        for (let view of views) {
          view.updateCrosshairPosition(center);
          
        }

      }

      else if (mode == MODE_ROTATE) {
        let dtheta = activeView.rotateCrosshair(localXY, client2canvas(mouseInfo.lastPos.x, mouseInfo.lastPos.y));
        for (let view of views) {
          if (view != activeView) {
            // rotate view.U and view.V dtheta around activeView.normal
            let rxf = m4.axisRotation(activeView.normal, -dtheta);
            m4.transformNormal(rxf, view.normal, view.normal);
            m4.transformDirection(rxf, view.U, view.U);
            m4.transformDirection(rxf, view.V, view.V);
            view.updateCrosshairPosition(center);
          }
        }
      }



  }
  else if (mouseInfo.buttonDown[0] == false && mouseInfo.buttonDown[1] == false && mouseInfo.buttonDown[2] == true) {
    activeView.displayWindow += dx;
    activeView.displayLevel += dy;
    console.log("w: " + activeView.displayWindow + "\tl: " + activeView.displayLevel);
  }

  else if (mouseInfo.buttonDown[0] == false && mouseInfo.buttonDown[1] == true && mouseInfo.buttonDown[2] == false) {
    // clicked and dragged with middle button
    if (dy < 0) {
      activeView.scale /= 1.1;
    } 
    else {
      activeView.scale *= 1.1;
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