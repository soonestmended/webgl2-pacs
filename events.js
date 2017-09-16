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

function getActiveView(event) {
  for (let view of views) {
    if (view.viewportContains(event.clientX, gl.canvas.height - event.clientY)) {
      return view;
    }
  }
  return null;
}

function handleMouseWheel(event) {
  event = event || window.event;
  console.log("Wheel");
  activeView = getActiveView(event);
  if (event.deltaY > 0) {
    activeView.translate(0, 0, 3);
  }
  else {
    activeView.translate(0, 0, -3);
  }
  console.log(activeView.xform[14]);
  event.preventDefault();
  event.stopPropagation();
}

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

  if (mouseInfo.buttonDown[0] == true && mouseInfo.buttonDown[1] == false && mouseInfo.buttonDown[2] == false) { // left button pressed
      var dx = mouseInfo.curPos.x - mouseInfo.lastPos.x;
      var dy = mouseInfo.curPos.y - mouseInfo.lastPos.y;
      activeView.translate(-dx, dy, 0);
  }
  else if (mouseInfo.buttonDown[0] == false && mouseInfo.buttonDown[1] == false && mouseInfo.buttonDown[2] == true) {
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