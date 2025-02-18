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

// 🔹 Récupère les couleurs du body
function getColors() {
    let bodyStyles = window.getComputedStyle(document.body);
    return {
        background: bodyStyles.backgroundColor || "#ffffff", // Blanc par défaut
        text: bodyStyles.color || "#000000" // Noir par défaut
    };
}

function setup() {
    createCanvas(windowWidth, windowHeight, WEBGL);
    adjustCanvasSize(); 
    updateColors(); // Applique les couleurs dès le départ
    prevMouseX = mouseX;
    prevMouseY = mouseY;
    offsetX = 0;
    offsetY = -height * 0.2;
}

function draw() {
    background(220); // Gris clair pour être sûr que le cube soit visible

    // 🎯 Correction de l'ortho pour s'assurer que le cube est bien visible
    ortho(-width / 2, width / 2, -height / 2, height / 2, -1000, 1000);
    translate(0, 0, 0);

    updateColors();

    // Applique les couleurs pour la box
    fill(cubeFillColor);
    stroke(cubeStrokeColor);
    strokeWeight(2);

    translate(offsetX, offsetY, 0);

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

// 📌 Gère les interactions souris
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

// 📌 Gère les interactions tactiles
function touchStarted(event) {
    if (event.target.tagName !== 'CANVAS') return true;
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

// 🖥️ Ajuste la taille du canvas selon l'écran
function adjustCanvasSize() {
    if (window.innerWidth < 760) {
        resizeCanvas(window.innerWidth * 0.8, window.innerHeight * 0.6, WEBGL);
    } else {
        resizeCanvas(windowWidth, windowHeight, WEBGL);
    }
    cubeSize = min(width, height) * 0.2;
}

// 🔹 Met à jour les couleurs de la box
function updateColors() {
    let colors = getColors();
    cubeFillColor = colors.background;
    cubeStrokeColor = colors.text;
}

// 📌 Redimensionne proprement le canvas
function windowResized() {
    adjustCanvasSize();
}
