//if (window.innerWidth <= 768) {
    // Bloque l'exécution du script et affiche un message centré
    //document.body.innerHTML = '<div id="mobile-message">Ce contenu n\'est pas disponible sur mobile.</div>';
   // document.body.style.display = "flex";
   // document.body.style.justifyContent = "center";
   // document.body.style.alignItems = "center";
  // document.body.style.height = "100vh";
   // document.body.style.textAlign = "center";
  //  document.body.style.fontSize = "18px";
  //  document.body.style.color = "red";
//} else {
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

    function getColors() {
        const backgroundColor = window.getComputedStyle(document.body).backgroundColor;
        const textColor = window.getComputedStyle(document.body).color;
        return { background: backgroundColor, text: textColor };
    }

    function setup() {
        let canvas = createCanvas(windowWidth, windowHeight, WEBGL);
        canvas.style("position", "absolute");
        canvas.style("top", "0");
        canvas.style("left", "0");
        canvas.style("z-index", "-1"); // Assure que le canvas est en arrière-plan

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
        background(0, 0); // Fond transparent

        ortho(-width / 2, width / 2, -height / 2, height / 2, -1000, 1000);
        translate(0, -height * 0.1, 0);

        const colors = getColors();
        cubeFillColor = colors.background;
        cubeStrokeColor = colors.text;

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

    function windowResized() {
        resizeCanvas(windowWidth, windowHeight);
        cubeSize = min(width, height) * 0.2;
    }
}
