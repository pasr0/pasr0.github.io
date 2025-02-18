window.addEventListener("load", function () {
    // Initialisation de la position de l'élément <h1> après le chargement de la page
    document.querySelector("h1").style.top = "20px";

    // Appliquer les couleurs stockées lors du chargement de la page
    applyStoredColors();
});

// Gestion des tooltips pour les éléments cliquables
const elements = document.querySelectorAll(".clickable");
const tooltip = document.getElementById("tooltip");

elements.forEach(element => {
    element.addEventListener("mouseenter", function () {
        const name = this.getAttribute("data-name");
        tooltip.textContent = name;
        tooltip.style.display = "block";
    });

    element.addEventListener("mousemove", function (event) {
        tooltip.style.left = event.pageX + 10 + "px";
        tooltip.style.top = event.pageY + 10 + "px";
    });

    element.addEventListener("mouseleave", function () {
        tooltip.style.display = "none";
    });
});

// Liste des palettes de couleurs définies
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
    { background: "#d3d7a1", text: "#0bb4c6" }
];

// Fonction pour changer les couleurs aléatoirement
function changeColors() {
    const randomPalette = palettes[Math.floor(Math.random() * palettes.length)];

    // Appliquer les couleurs au body et aux liens
    document.body.style.backgroundColor = randomPalette.background;
    document.body.style.color = randomPalette.text;

    const links = document.querySelectorAll("a");
    links.forEach(link => {
        link.style.color = randomPalette.text;
    });

    const button = document.getElementById("colorButton");
    button.style.color = randomPalette.text;

    // Sauvegarder les couleurs dans le localStorage
    localStorage.setItem("backgroundColor", randomPalette.background);
    localStorage.setItem("textColor", randomPalette.text);

    // Appliquer les styles du scrollbar
    applyScrollbarStyles(randomPalette);
}

// Fonction pour appliquer les couleurs stockées dans le localStorage
function applyStoredColors() {
    const storedBackgroundColor = localStorage.getItem("backgroundColor");
    const storedTextColor = localStorage.getItem("textColor");

    if (storedBackgroundColor && storedTextColor) {
        document.body.style.backgroundColor = storedBackgroundColor;
        document.body.style.color = storedTextColor;

        const links = document.querySelectorAll("a");
        links.forEach(link => {
            link.style.color = storedTextColor;
        });

        const button = document.getElementById("colorButton");
        button.style.color = storedTextColor;

        // Appliquer les styles du scrollbar avec les couleurs stockées
        applyScrollbarStyles({ background: storedBackgroundColor, text: storedTextColor });
    }
}

// Fonction pour appliquer les styles de scrollbar
function applyScrollbarStyles(palette) {
    let style = document.getElementById("scrollbar-style");
    if (!style) {
        style = document.createElement("style");
        style.id = "scrollbar-style";
        document.head.appendChild(style);
    }

    style.innerHTML = `
        ::-webkit-scrollbar {
            width: 10px;
        }
        ::-webkit-scrollbar-track {
            background: ${palette.background};
        }
        ::-webkit-scrollbar-thumb {
            background: ${palette.text};
            border-radius: 5px;
        }
    `;
}

// Ajouter l'événement pour changer les couleurs au clic du bouton
document.getElementById("colorButton").addEventListener("click", changeColors);

// Gestion de l'affichage du background de home-index
document.addEventListener("DOMContentLoaded", function () {
    const h1 = document.querySelector("h1");
    const couleurBtn = document.getElementById("colorButton");
    const homeIndex = document.getElementById("home-link");

    if (!h1 || !couleurBtn || !homeIndex) return;

    h1.addEventListener("click", function () {
        homeIndex.style.backgroundColor = "transparent";
    });

    couleurBtn.addEventListener("click", function () {
        const storedBackgroundColor = localStorage.getItem("backgroundColor");
        if (storedBackgroundColor) {
            homeIndex.style.backgroundColor = storedBackgroundColor;
        }
    });
});
