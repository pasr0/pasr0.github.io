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
