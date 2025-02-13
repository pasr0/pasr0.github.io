let angleX = 0; // Rotation initiale sur l'axe X
let angleY = 0; // Rotation initiale sur l'axe Y
let offsetX = 0; // Décalage pour le déplacement du cube
let offsetY = 0; // Décalage pour le déplacement du cube
let dragging = false; // Détection si on fait du drag
let cubeFillColor, cubeStrokeColor; // Couleurs du cube
let prevMouseX, prevMouseY; // Pour suivre la position précédente de la souris
let cubeSize;

// Fonction pour récupérer la couleur de fond et la couleur de texte du body
function getColors() {
    const backgroundColor = window.getComputedStyle(document.body).backgroundColor;
    const textColor = window.getComputedStyle(document.body).color;
    return { background: backgroundColor, text: textColor };
}

function setup() {
    createCanvas(windowWidth, windowHeight, WEBGL);
    prevMouseX = mouseX;
    prevMouseY = mouseY;
    const colors = getColors();
    cubeFillColor = colors.background; // Initialiser la couleur de remplissage avec la couleur de fond actuelle
    cubeStrokeColor = colors.text; // Initialiser la couleur du contour avec la couleur du texte actuelle
    cubeSize = min(width, height) * 0.2; 
}


function draw() {
    background(cubeFillColor)

    ortho(-width / 2, width / 2, -height / 2, height / 2, -1000, 1000);

    // Positionnement du cube légèrement au-dessus du centre
    translate(0, -height * 0.1, 0);
  

    // Rotation automatique
    angleX += 0.01; // Rotation continue sur l'axe X
    angleY += 0.01; // Rotation continue sur l'axe Y

    // Récupérer les couleurs de fond et de texte dynamiques
    const colors = getColors();
    cubeFillColor = colors.background;
    cubeStrokeColor = colors.text;

    // Appliquer la couleur de remplissage (fill) et contour (stroke)
    fill(cubeFillColor);
    stroke(cubeStrokeColor);
    strokeWeight(2);

    // Appliquer les déplacements du cube
    translate(offsetX, offsetY, 0);

    // Rotation basée sur la souris
    let deltaX = mouseX - prevMouseX; // Calcul du mouvement horizontal de la souris
    let deltaY = mouseY - prevMouseY; // Calcul du mouvement vertical de la souris

    angleX += deltaY * 0.01; // Rotation en fonction du mouvement vertical de la souris
    angleY += deltaX * 0.01; // Rotation en fonction du mouvement horizontal de la souris

    // Appliquer les rotations
    rotateX(angleX);
    rotateY(angleY);

    // Dessiner un cube avec un remplissage et un contour
    box(cubeSize);



    // Mettre à jour la position précédente de la souris pour le prochain frame
    prevMouseX = mouseX;
    prevMouseY = mouseY;
}

// Fonction pour gérer le début du drag
function mousePressed() {
    dragging = true;
}

// Fonction pour gérer le déplacement du cube
function mouseDragged() {
    if (dragging) {
        offsetX += (mouseX - pmouseX); // Déplacer le cube en X
        offsetY += (mouseY - pmouseY); // Déplacer le cube en Y
    }
}

// Arrêter le drag lorsque la souris est relâchée
function mouseReleased() {
    dragging = false;
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    cubeSize = min(width, height) * 0.2;
  }
