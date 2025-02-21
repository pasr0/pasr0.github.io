let angleX = 0;
let angleY = 0;
let offsetX = 0;
let offsetY = 0;
let dragging = false;
let cubeFillColor, cubeStrokeColor;
let prevMouseX, prevMouseY;
let cubeSize;
let velocityY = 0;
let gravity = 0.3;
let bounceFactor = 0.8;
let touchStartX, touchStartY;

function getColors() {
    const backgroundColor = window.getComputedStyle(document.body).backgroundColor;
    const textColor = window.getComputedStyle(document.body).color;
    return { background: backgroundColor, text: textColor };
}

function setup() {
    let canvas = createCanvas(windowWidth, windowHeight, WEBGL);
    canvas.parent(document.body);

    let nav = document.querySelector("nav");
    document.body.insertBefore(canvas.elt, nav);

    prevMouseX = mouseX;
    prevMouseY = mouseY;
    const colors = getColors();
    cubeFillColor = colors.background;
    cubeStrokeColor = colors.text;
    cubeSize = min(width, height) * 0.2;
    offsetX = 0;
    offsetY = -height * 0.5;
}

function draw() {
    ortho(-width / 2, width / 2, -height / 2, height / 2, -1000, 1000);
    translate(0, -height * 0.1, 0);

    const colors = getColors();
    cubeFillColor = colors.background;
    cubeStrokeColor = colors.text;

    fill(cubeFillColor);
    stroke(cubeStrokeColor);
    strokeWeight(2);

    translate(offsetX, offsetY, 0);

    angleX += 0.01;
    angleY += 0.01;

    let deltaX = mouseX - prevMouseX;
    let deltaY = mouseY - prevMouseY;
    angleX += deltaY * 0.01;
    angleY += deltaX * 0.01;

    rotateX(angleX);
    rotateY(angleY);
    box(cubeSize);

    velocityY += gravity;
    offsetY += velocityY;

    if (offsetY + cubeSize / 2 >= height / 2) {
        offsetY = height / 2 - cubeSize / 2;
        velocityY *= -bounceFactor;
    }

    if (offsetY - cubeSize / 2 <= -height / 2) {
        offsetY = -height / 2 + cubeSize / 2;
        velocityY *= -bounceFactor;
    }

    prevMouseX = mouseX;
    prevMouseY = mouseY;
}

function mousePressed() {
    dragging = true;
}

function mouseDragged() {
    if (dragging) {
        offsetX += (mouseX - pmouseX);
        offsetY += (mouseY - pmouseY);
    }
}

function mouseReleased() {
    dragging = false;
}

// Support tactile
function touchStarted() {
    dragging = true;
    touchStartX = touches[0].x;
    touchStartY = touches[0].y;
    return false;
}

function touchMoved() {
    if (dragging && touches.length > 0) {
        let touchX = touches[0].x;
        let touchY = touches[0].y;

        offsetX += (touchX - touchStartX);
        offsetY += (touchY - touchStartY);

        touchStartX = touchX;
        touchStartY = touchY;
    }
    return false;
}

function touchEnded() {
    dragging = false;
    return false;
}

if (window.innerWidth <= 768) {
    document.body.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-size: 18px; color: red; text-align: center;">Ce contenu n\'est pas disponible sur mobile.</div>';
} else {
    var script = document.createElement('script');
    script.src = "box.js";
    document.head.appendChild(script);
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    cubeSize = min(width, height) * 0.2;
}
