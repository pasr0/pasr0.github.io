window.addEventListener('load', function() {
  document.querySelector('h1').style.top = '20px';
});

const elements = document.querySelectorAll('.clickable');
const tooltip = document.getElementById('tooltip');

elements.forEach(element => {
    element.addEventListener('mouseenter', function() {
        const name = this.getAttribute('data-name');
        tooltip.textContent = name;
        tooltip.style.display = 'block';
    });

    element.addEventListener('mousemove', function(event) {
        tooltip.style.left = event.pageX + 10 + 'px'; // Positionne le tooltip légèrement à droite du curseur
        tooltip.style.top = event.pageY + 10 + 'px';  // Positionne le tooltip légèrement en dessous du curseur
    });

    element.addEventListener('mouseleave', function() {
        tooltip.style.display = 'none'; // Cache le tooltip quand le curseur quitte l'élément
    });
});

// Palettes avec une couleur de fond et une couleur de texte contrastée
const palettes = [
  { background: "#a5dcf8", text: "#664cde" }, 
  { background: "#f9f274", text: "#8311ef" }, 
  { background: "#5de537", text: "#0b0baf" }, 
  { background: "#b0c942", text: "#edf6d1" }, 
  { background: "#d2bfa7", text: "#3d78b2" }, 
  { background: "#000000", text: "#ffffff" }, 
  { background: "#ffffff", text: "#000000" }, 
  { background: "#c6dbb5", text: "#d44e14" }, 
  { background: "#1625f6", text: "#eadde7" }, 
  { background: "#e6733e", text: "#edeb5d" }, 
  { background: "#fcddc4", text: "#2f7eb7" }, 
  { background: "#d3d7a1", text: "#0bb4c6" }, 
];

// Fonction pour changer les couleurs du fond et du texte
function changeColors() {
  // Choisir une palette aléatoire
  const randomPalette = palettes[Math.floor(Math.random() * palettes.length)];

  // Appliquer la couleur de fond et du texte au body
  document.body.style.backgroundColor = randomPalette.background;
  document.body.style.color = randomPalette.text;

  // Modifier la couleur des liens
  const links = document.querySelectorAll('a');
  links.forEach(link => {
      link.style.color = randomPalette.text;
  });

  // Modifier la couleur du bouton
  const button = document.getElementById('colorButton');
  button.style.backgroundColor = randomPalette.background;
  button.style.color = randomPalette.text;

  // Sauvegarder les couleurs dans le localStorage pour qu'elles persistent sur toutes les pages
  localStorage.setItem('backgroundColor', randomPalette.background);
  localStorage.setItem('textColor', randomPalette.text);
}

// Fonction pour appliquer les couleurs sauvegardées au chargement de la page
function applyStoredColors() {
  const storedBackgroundColor = localStorage.getItem('backgroundColor');
  const storedTextColor = localStorage.getItem('textColor');

  // Si les couleurs sont stockées, les appliquer
  if (storedBackgroundColor && storedTextColor) {
      document.body.style.backgroundColor = storedBackgroundColor;
      document.body.style.color = storedTextColor;

      // Appliquer la couleur aux liens
      const links = document.querySelectorAll('a');
      links.forEach(link => {
          link.style.color = storedTextColor;
      });

      // Appliquer les couleurs au bouton
      const button = document.getElementById('colorButton');
  
      button.style.color = storedTextColor;
  }
}

window.onload = applyStoredColors;

// Ajouter un événement au bouton pour changer les couleurs lors du clic
document.getElementById('colorButton').addEventListener('click', changeColors);
