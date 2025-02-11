let ellipses = [];
let draggingEllipse = null;
let graphics;

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);

  graphics = createGraphics(windowWidth, windowHeight);
  graphics.clear();

  canvas.parent("p5-container"); // Attacher le canevas au div avec id "p5-container"
  
  // Créer plusieurs ellipses avec des couleurs harmonieuses
  for (let i = 0; i < 16; i++) {
    let newEllipse;
    do {
      newEllipse = new DraggableEllipse(random(width), random(height), randomColor(), random(80, 150), random(100, 200));
    } while (isOverlap(newEllipse));
    ellipses.push(newEllipse);
  }
}

function draw() {
  background(240);
  
  // Afficher et mettre à jour les ellipses
  for (let e of ellipses) {
    e.update();
    e.display();
  }
}

function mousePressed() {
  for (let e of ellipses) {
    if (e.isMouseOver()) {
      draggingEllipse = e;
      e.startDrag(mouseX, mouseY);
      break;
    }
  }
}

function mouseReleased() {
  if (draggingEllipse) {
    draggingEllipse.stopDrag();
    draggingEllipse = null;
  }
}

function isOverlap(newEllipse) {
  for (let e of ellipses) {
    let d = dist(newEllipse.x, newEllipse.y, e.x, e.y);
    let minDist = (newEllipse.w + e.w) / 2;
    if (d < minDist) {
      return true;
    }
  }
  return false;
}

function randomColor() {
  return color(random(100, 255), random(100, 255), random(100, 255));
}

class DraggableEllipse {
  constructor(x, y, col, w, h) {
    this.x = x;
    this.y = y;
    this.col = col;
    this.w = w;
    this.h = h;
    this.dragging = false;
    this.offsetX = 0;
    this.offsetY = 0;
    this.oscillationAmplitudeX = 10;
    this.oscillationAmplitudeY = 8;
    this.oscillationSpeed = 0.02;
    this.phaseOffset = random(TWO_PI);
    this.oscillationAngle = 0;
  }
  
  display() {
    drawingContext.filter = 'blur(100px)';
    fill(this.col);
    noStroke();
    let oscillationX = sin(this.oscillationAngle + this.phaseOffset) * this.oscillationAmplitudeX;
    let oscillationY = cos(this.oscillationAngle + this.phaseOffset) * this.oscillationAmplitudeY;
  
    ellipse(this.x + oscillationX, this.y + oscillationY, this.w, this.h);
  
    drawingContext.filter = 'none';
  }

  
  update() {
    if (this.dragging) {
      this.x = mouseX + this.offsetX;
      this.y = mouseY + this.offsetY;
    } else {
      this.oscillationAngle += this.oscillationSpeed;
    }
  }
  
  isMouseOver() {
    let d = dist(mouseX, mouseY, this.x, this.y);
    return d < this.w / 2;
  }
  
  startDrag(mx, my) {
    this.offsetX = this.x - mx;
    this.offsetY = this.y - my;
    this.dragging = true;
  }

  stopDrag() {
    this.dragging = false;
  }
}
