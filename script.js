// Scene, Camera, and Renderer setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Change the background color to white
renderer.setClearColor(0xffffff, 1); // 0xffffff = blanc, 1 = opaque

// Objects in the scene
const material = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true }); // Wireframe noir

// Position des objets au début (au sommet du canvas)
const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), material);
sphere.position.set(-3, 10, 0); // 10 unités au-dessus du canvas
scene.add(sphere);

const cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
cube.position.set(3, 10, 0); // 10 unités au-dessus du canvas
scene.add(cube);

// Set up gravity and physics
const gravity = -0.05;  // Acceleration due to gravity
let velocity = new THREE.Vector3(0, 0, 0);  // Initial velocity

// Raycasting for grabbing objects (not used for now)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedObject = null;
let isGrabbing = false;

window.addEventListener('mousedown', onMouseDown, false);
window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('mouseup', onMouseUp, false);
window.addEventListener('resize', onWindowResize, false);

// Gravity effect and animation loop
function animate() {
  requestAnimationFrame(animate);

  velocity.y += gravity;  // Apply gravity to velocity

  // Apply velocity to objects
  sphere.position.y += velocity.y;
  cube.position.y += velocity.y;

  // Collision detection with the ground (simple)
  if (sphere.position.y <= 0) {
    sphere.position.y = 0;
    velocity.y = 0;
  }

  if (cube.position.y <= 0) {
    cube.position.y = 0;
    velocity.y = 0;
  }

  renderer.render(scene, camera);
}

// Adjust the camera to show all objects
camera.position.z = 10;
camera.position.y = 5;  // Adjusting Y to see both objects fall
animate();

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
