// ColoredPoints.js
// Vertex shader program
var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform float u_Size;
  void main() {
    gl_Position = a_Position;
    gl_PointSize = u_Size;
  }`;

// Fragment shader program
var FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }`;

// Global Variables
let canvas;
let gl;
let a_Position;
let u_FragColor;
let u_Size;

// Constants
const POINT = 0;
const TRIANGLE = 1;
const CIRCLE = 2;

// UI Globals
let g_selectedColor = [1.0, 1.0, 1.0, 1.0]; // Default white
let g_selectedSize = 5;
let g_selectedType = POINT;
let g_selectedSegments = 10;

// --- RAINBOW GLOBALS ---
let g_rainbowMode = false;
let rainbowHue = 0;

// --- ANIMATION GLOBALS ---
let g_animationId = null; 

// List of shapes to draw
var g_shapesList = [];

function main() {
  // Retrieve <canvas> element
  canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
  gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // Get the storage location of a_Position
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return;
  }

  // Get the storage location of u_FragColor
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return;
  }

  // Get the storage location of u_Size
  u_Size = gl.getUniformLocation(gl.program, 'u_Size');
  if (!u_Size) {
    console.log('Failed to get the storage location of u_Size');
    return;
  }

  // Register function (event handler) to be called on a mouse press
  canvas.onmousedown = click;
  
  // Optional: Enable drawing while dragging
  canvas.onmousemove = function(ev) { if(ev.buttons == 1) { click(ev) } };

  // Set up all the event handlers for buttons and sliders
  addActionsForHtmlUI();

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT);
}

function addActionsForHtmlUI() {
  // Button Events (Color)
  document.getElementById('green').onclick = function() { g_selectedColor = [0.0, 1.0, 0.0, 1.0]; };
  document.getElementById('blue').onclick = function() { g_selectedColor = [0.0, 0.0, 1.0, 1.0]; };
  document.getElementById('red').onclick = function() { g_selectedColor = [1.0, 0.0, 0.0, 1.0]; };
  
  // Button Events (Clear)
  document.getElementById('clearButton').onclick = function() { 
      stopScatterAnimation(); 
      g_shapesList = []; 
      renderAllShapes(); 
  };
  
  // Button Events (Shape and Picture Type)
  document.getElementById('pointButton').onclick = function() { g_selectedType = POINT; };
  document.getElementById('triButton').onclick = function() { g_selectedType = TRIANGLE; };
  document.getElementById('circleButton').onclick = function() { g_selectedType = CIRCLE; };
  

  // --- SCATTER BUTTON ---
  document.getElementById('scatterButton').onclick = function() {
    if (g_animationId === null) {
      scatterAnimation();
    } else {
      stopScatterAnimation();
    }
  };
  
  // --- RAINBOW BUTTONS ---
  if(document.getElementById('rainbow')) {
      document.getElementById('rainbow').onclick = function() { 
          g_rainbowMode = true; 
      };
  }
  if(document.getElementById('off')) {
      document.getElementById('off').onclick = function() { 
          g_rainbowMode = false; 
          g_selectedColor = [1.0, 1.0, 1.0, 1.0]; 
      };
  }

  // Slider Events
  document.getElementById('redSlide').addEventListener('mouseup', function() { g_selectedColor[0] = this.value/100; });
  document.getElementById('greenSlide').addEventListener('mouseup', function() { g_selectedColor[1] = this.value/100; });
  document.getElementById('blueSlide').addEventListener('mouseup', function() { g_selectedColor[2] = this.value/100; });

  // Size Slider Events
  document.getElementById('sizeSlide').addEventListener('mouseup', function() { g_selectedSize = this.value; });
  
  // Segment Slider
  document.getElementById('segmentSlide').addEventListener('mouseup', function() { g_selectedSegments = this.value; });
}

function click(ev) {
  let [x, y] = convertCoordinatesEventToGL(ev);

  // --- RAINBOW LOGIC ---
  if (g_rainbowMode) {
    rainbowHue += 0.05; 
    if (rainbowHue > 1) {
      rainbowHue = 0;
    }
    g_selectedColor = hslToRgb(rainbowHue, 1.0, 0.5);
  }

  let point;
  if (g_selectedType == POINT) {
    point = new Point();
  } else if (g_selectedType == TRIANGLE) {
    point = new Triangle();
  } else {
    point = new Circle();
    point.segments = g_selectedSegments; 
  }

  point.position = [x, y];
  point.color = g_selectedColor.slice();
  point.size = g_selectedSize;
  
  g_shapesList.push(point);
  renderAllShapes();
}

function convertCoordinatesEventToGL(ev) {
  var x = ev.clientX; 
  var y = ev.clientY; 
  var rect = ev.target.getBoundingClientRect();

  x = ((x - rect.left) - canvas.width/2)/(canvas.width/2);
  y = (canvas.height/2 - (y - rect.top))/(canvas.height/2);

  return [x, y];
}

function renderAllShapes() {
  var startTime = performance.now();

  gl.clear(gl.COLOR_BUFFER_BIT);

  var len = g_shapesList.length;
  for(var i = 0; i < len; i++) {
    g_shapesList[i].render();
  }

  var duration = performance.now() - startTime;
  sendTextToHTML("numdot: " + len + " ms: " + Math.floor(duration) + " fps: " + Math.floor(10000/duration)/10, "numdot");
}

function sendTextToHTML(text, htmlID) {
  var htmlElm = document.getElementById(htmlID);
  if (!htmlElm) {
    console.log("Failed to get " + htmlID + " from HTML");
    return;
  }
  htmlElm.innerHTML = text;
}

// --- HELPER FUNCTION: Convert HSL to RGB --- see https://github.com/adappt/rainbow-colors/blob/36b8f7b72565982abd3dd663d54d57092f90c101/index.ts#L4
function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l; 
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [r, g, b, 1.0];
}

// --- ANIMATION FUNCTIONS ---
function scatterAnimation() {
  // 1. Initialize velocities for shapes that don't have them
  // We do this once before starting the loop
  g_shapesList.forEach(shape => {
    if (!shape.vx) {
      // Random velocity between -0.01 and 0.01
      shape.vx = (Math.random() - 0.5) * 0.02; 
      shape.vy = (Math.random() - 0.5) * 0.02;
    }
  });

  // 2. Define the animation frame function
  function tick() {
    // Loop through all shapes to update positions
    for (let i = 0; i < g_shapesList.length; i++) {
      let shape = g_shapesList[i];

      // --- CASE A: Standard Shapes (Point, Triangle, Circle) ---
      if (shape.position) {
        shape.position[0] += shape.vx;
        shape.position[1] += shape.vy;

        // BOUNCE LOGIC: Check boundaries (-1.0 to 1.0)
        // If it hits a wall, flip the velocity
        if (shape.position[0] > 1.0 || shape.position[0] < -1.0) {
          shape.vx = -shape.vx;
        }
        if (shape.position[1] > 1.0 || shape.position[1] < -1.0) {
          shape.vy = -shape.vy;
        }
      } 
      
      // --- CASE B: Picture Shapes (CustomTriangle) ---
      else if (shape.vertices) {
        let hitWallX = false;
        let hitWallY = false;

        // Move vertices
        for (let j = 0; j < shape.vertices.length; j += 2) {
          shape.vertices[j]     += shape.vx; // X
          shape.vertices[j + 1] += shape.vy; // Y

          // Check bounds on this vertex
          if (shape.vertices[j] > 1.0 || shape.vertices[j] < -1.0) hitWallX = true;
          if (shape.vertices[j+1] > 1.0 || shape.vertices[j+1] < -1.0) hitWallY = true;
        }

        // Apply bounce if any part hit a wall
        if (hitWallX) shape.vx = -shape.vx;
        if (hitWallY) shape.vy = -shape.vy;
      }
    }

    // 3. Draw the updated scene
    renderAllShapes();

    // 4. Request the next frame recursively
    g_animationId = requestAnimationFrame(tick);
  }

  // Start the loop
  tick();
}

function stopScatterAnimation() {
  if (g_animationId !== null) {
    // Cancel the requestAnimationFrame loop
    cancelAnimationFrame(g_animationId);
    g_animationId = null;
  }
}


// Part 12: Draw a Picture
function drawPicture() { 
  // 1. Clear existing shapes
  g_shapesList = []; 

  // --- Helper: Push a triangle object to the global list ---
  function addTri(coords, color) {
    // Create a new object and push it to the list
    // Assumes CustomTriangle is loaded from another file
    let t = new CustomTriangle(coords, color);
    g_shapesList.push(t);
  }

  // --- Helper: Push a Quad (2 triangles) to the global list ---
  function addQuad(x1, y1, x2, y2, x3, y3, x4, y4, color) {
    addTri([x1, y1, x2, y2, x4, y4], color);
    addTri([x2, y2, x3, y3, x4, y4], color);
  }

  // Define Colors
  let maskDark  = [0.1, 0.1, 0.1, 1.0];  
  let maskLight = [0.2, 0.2, 0.25, 1.0]; 
  let glow      = [0.0, 1.0, 0.8, 1.0];  
  let shadow    = [0.0, 0.7, 0.6, 1.0];  
  let accent    = [1.0, 0.2, 0.2, 1.0];  

  
  // 1. THE MASK SHELL
  
  // Forehead
  addTri([0.0, 0.8, -0.5, 0.5,  0.5, 0.5], maskLight);
  // Jaw
  addTri([0.0, -0.9, -0.4, -0.5, 0.4, -0.5], maskDark);
  // Left Cheek
  addQuad(-0.8, 0.5, -0.5, 0.3, -0.4, -0.5, -0.7, -0.2, maskLight);
  // Right Cheek
  addQuad( 0.8, 0.5,  0.5, 0.3,  0.4, -0.5,  0.7, -0.2, maskLight);

  // 2. THE INITIALS "OR" (EYES)
  
  
  // --- LETTER O ---
  addQuad(-0.5, 0.4, -0.4, 0.4, -0.4, -0.1, -0.5, -0.1, glow);   // Left
  addQuad(-0.2, 0.4, -0.1, 0.4, -0.1, -0.1, -0.2, -0.1, shadow); // Right
  addQuad(-0.5, 0.4, -0.1, 0.4, -0.1, 0.3,  -0.5, 0.3,  glow);   // Top
  addQuad(-0.5, -0.1, -0.1, -0.1, -0.1, -0.2, -0.5, -0.2, shadow); // Bottom

  // --- LETTER R ---
  addQuad(0.1, 0.4,  0.2, 0.4,  0.2, -0.2,  0.1, -0.2, glow);    // Spine
  addQuad(0.2, 0.4,  0.5, 0.4,  0.5, 0.3,   0.2, 0.3, glow);     // Top Loop H
  addQuad(0.4, 0.4,  0.5, 0.4,  0.5, 0.1,   0.4, 0.1, shadow);   // Top Loop V
  addQuad(0.2, 0.1,  0.5, 0.1,  0.5, 0.2,   0.2, 0.2, shadow);   // Mid Bar
  
  // Diagonal Leg
  addTri([0.2, 0.1,  0.35, 0.1,  0.5, -0.2], glow);
  addTri([0.2, 0.1,  0.5, -0.2,  0.35, -0.2], shadow);

  
  // 3. DETAILS
  
  // Nose Bridge (Structural connector)
  addQuad(-0.1, 0.2, 0.1, 0.2, 0.1, 0.0, -0.1, 0.0, maskDark);
  // Nose Spike
  addTri([0.0, 0.0, -0.1, -0.2, 0.1, -0.2], maskDark);
  // Antennae
  addTri([-0.3, 0.4, -0.2, 0.7, -0.35, 0.4], accent);
  addTri([ 0.3, 0.4,  0.4, 0.7,  0.35, 0.4], accent);
  // Chin Vent
  addQuad(-0.1, -0.6, 0.1, -0.6, 0.05, -0.8, -0.05, -0.8, accent);

  // --- FINAL STEP: Draw everything ---
  renderAllShapes();
}