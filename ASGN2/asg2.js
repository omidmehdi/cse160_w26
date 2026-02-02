// Vertex Shader
const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotateMatrix;
  void main() {
    gl_Position = u_GlobalRotateMatrix * u_ModelMatrix * a_Position;
  }
`;

// Fragment Shader
const FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }
`;

// Global Variables
let canvas, gl;
let a_Position, u_FragColor, u_ModelMatrix, u_GlobalRotateMatrix;

// Geometry Buffers
let g_cubeBuffer = null;
let g_wedgeBuffer = null; 

// UI State Variables (Camera)
let g_globalAngleX = 0;
let g_globalAngleY = 0;
let g_zoom = 0;

// === JOINT VARIABLES ===
// Separated into "Base" (Slider Value) and "Render" (Final Value passed to shader)

// Render Values (Used in renderScene)
let g_headAngle = 0;
let g_earAngle = 0;
let g_tailAngle = 0; 
let g_footAngleL = 0;
let g_footAngleR = 0;
let g_FL = [0, 0]; 
let g_FR = [0, 0]; 
let g_BL = [0, 0]; 
let g_BR = [0, 0]; 

// Base Values (Set by Sliders)
let g_head_base = 0;
let g_ear_base = 0;
// Tail is purely animated, no slider base
let g_footL_base = 0;
let g_footR_base = 0;
let g_FL_base = [0, 0]; 
let g_FR_base = [0, 0]; 
let g_BL_base = [0, 0]; 
let g_BR_base = [0, 0]; 

// Animation State
let g_animationOn = false;
let g_pokeAnimation = false;
let g_pokeTime = 0;
let g_mag = 0; // Explosion magnitude

// Performance
let g_startTime = performance.now();
let g_seconds = 0;
let g_fpsCounter = 0;
let g_lastFpsTime = 0;

function main() {
    canvas = document.getElementById('webgl');
    gl = getWebGLContext(canvas);
    if (!gl) { console.log('Failed to get WebGL context'); return; }

    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) return;

    a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
    u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    u_GlobalRotateMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotateMatrix');

    initVertexBuffers(gl);
    gl.clearColor(0.0, 0.0, 0.0, 1.0); // Black background
    gl.enable(gl.DEPTH_TEST);
    
    // Fix depth fighting (Z-fighting)
    gl.polygonOffset(1.0, 1.0);
    gl.enable(gl.POLYGON_OFFSET_FILL);

    setupUI();
    requestAnimationFrame(tick);
}

function initVertexBuffers(gl) {
    // 1. Standard Unit Cube (0 to 1)
    const cubeVerts = new Float32Array([
        0,0,0, 1,1,0, 1,0,0,  0,0,0, 0,1,0, 1,1,0, // Front
        0,0,1, 1,1,1, 1,0,1,  0,0,1, 0,1,1, 1,1,1, // Back
        0,1,0, 1,1,1, 1,1,0,  0,1,0, 0,1,1, 1,1,1, // Top
        0,0,0, 1,0,1, 1,0,0,  0,0,0, 0,0,1, 1,0,1, // Bottom
        0,0,0, 0,1,1, 0,1,0,  0,0,0, 0,0,1, 0,1,1, // Left
        1,0,0, 1,1,1, 1,1,0,  1,0,0, 1,0,1, 1,1,1  // Right
    ]);
    g_cubeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeVerts, gl.STATIC_DRAW);

    // 2. Unit Wedge (Triangle Prism for Neck)
    const wedgeVerts = new Float32Array([
        // Front face (Triangle)
        0,0,0, 1,0,0, 0,1,0,
        // Back face (Triangle)
        0,0,1, 0,1,1, 1,0,1,
        // Bottom face
        0,0,0, 0,0,1, 1,0,1,   0,0,0, 1,0,1, 1,0,0,
        // Back wall (Straight vertical)
        0,0,0, 0,1,0, 0,1,1,   0,0,0, 0,1,1, 0,0,1,
        // Sloped face (Hypotenuse)
        1,0,0, 1,0,1, 0,1,1,   1,0,0, 0,1,1, 0,1,0
    ]);
    g_wedgeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_wedgeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, wedgeVerts, gl.STATIC_DRAW);
}

// --- Draw Helpers ---

function drawCube(M, color) {
    gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);
    gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
    gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);
    gl.drawArrays(gl.TRIANGLES, 0, 36);
}

function drawWedge(M, color) {
    gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);
    gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
    gl.bindBuffer(gl.ARRAY_BUFFER, g_wedgeBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);
    gl.drawArrays(gl.TRIANGLES, 0, 24); 
}

function setupUI() {
    // Camera
    document.getElementById('angleY').oninput = function() { g_globalAngleY = this.value; };
    document.getElementById('angleX').oninput = function() { g_globalAngleX = this.value; };
    document.getElementById('zoomSlide').oninput = function() { g_zoom = this.value; };

    // Head - Updates Base Value
    document.getElementById('headSlide').oninput = function() { g_head_base = parseInt(this.value); };
    document.getElementById('earSlide').oninput = function() { g_ear_base = parseInt(this.value); };

    // Legs - Updates Base Values
    document.getElementById('fl_leg').oninput = function() { g_FL_base[0] = parseInt(this.value); };
    document.getElementById('fl_calf').oninput = function() { g_FL_base[1] = parseInt(this.value); };
    document.getElementById('footSlideL').oninput = function() { g_footL_base = parseInt(this.value); };

    document.getElementById('fr_leg').oninput = function() { g_FR_base[0] = parseInt(this.value); };
    document.getElementById('fr_calf').oninput = function() { g_FR_base[1] = parseInt(this.value); };
    document.getElementById('footSlideR').oninput = function() { g_footR_base = parseInt(this.value); };

    document.getElementById('bl_leg').oninput = function() { g_BL_base[0] = parseInt(this.value); };
    document.getElementById('bl_calf').oninput = function() { g_BL_base[1] = parseInt(this.value); };

    document.getElementById('br_leg').oninput = function() { g_BR_base[0] = parseInt(this.value); };
    document.getElementById('br_calf').oninput = function() { g_BR_base[1] = parseInt(this.value); };

    // Buttons
    document.getElementById('animToggleButton').onclick = function() { 
        g_animationOn = !g_animationOn; 
    };

    // Explosion Button
    document.getElementById('explodeButton').onclick = function() {
        startExplosion();
    };
    
    document.getElementById('resetButton').onclick = function() {
        g_animationOn = false;
        g_pokeAnimation = false;
        g_mag = 0;
        
        // Reset Bases
        g_head_base = 0; g_ear_base = 0; 
        g_footL_base = 0; g_footR_base = 0;
        g_FL_base = [0,0]; g_FR_base = [0,0]; g_BL_base = [0,0]; g_BR_base = [0,0];
        
        // Reset Sliders in UI
        const inputs = document.getElementsByTagName('input');
        for(let i=0; i<inputs.length; i++) {
            if(inputs[i].id.includes("angle") || inputs[i].id.includes("zoom")) continue; 
            inputs[i].value = 0;
            inputs[i].dispatchEvent(new Event('input')); 
        }
    };

    // Mouse Interactions (Shift-Click to Explode)
    canvas.onmousedown = function(ev) {
        if(ev.shiftKey) {
            startExplosion();
        } else {
            let lastX = ev.clientX;
            let lastY = ev.clientY;
            
            canvas.onmousemove = function(e) {
                let dx = e.clientX - lastX;
                let dy = e.clientY - lastY;
                g_globalAngleY = (parseFloat(g_globalAngleY) + dx);
                g_globalAngleX = (parseFloat(g_globalAngleX) + dy);
                
                document.getElementById('angleY').value = g_globalAngleY % 360;
                document.getElementById('angleX').value = g_globalAngleX;
                
                lastX = e.clientX;
                lastY = e.clientY;
            };
        }
    };
    canvas.onmouseup = function() { canvas.onmousemove = null; };
}

function startExplosion() {
    g_pokeAnimation = true;
    g_pokeTime = g_seconds;
}

function tick() {
    g_seconds = (performance.now() - g_startTime) / 1000.0;
    
    updateAnimation();
    renderScene();

    // FPS Counter
    let now = performance.now();
    g_fpsCounter++;
    if(now - g_lastFpsTime >= 1000) {
        document.getElementById('fps').innerText = "FPS: " + g_fpsCounter;
        g_fpsCounter = 0;
        g_lastFpsTime = now;
    }
    
    requestAnimationFrame(tick);
}

function updateAnimation() {
    // === 1. EXPLOSION LOGIC===
    if (g_pokeAnimation) {
        let dt = g_seconds - g_pokeTime;
        if(dt > 2.0) { // Explode for 2 seconds then reset
            g_pokeAnimation = false;
            g_mag = 0;
        } else {
            // "Pop" curve: fast expansion
            g_mag = 5.0 * (1 - Math.exp(-3 * dt)); 
            
            // Hard reset pose during explosion
            g_headAngle = 0; g_earAngle = 0; g_tailAngle = 0;
            g_FL = [0,0]; g_FR = [0,0]; g_BL = [0,0]; g_BR = [0,0];
            return; // Exit early so base+offset logic doesn't interfere
        }
    } else {
        if (g_mag > 0.01) g_mag *= 0.9; else g_mag = 0;
    }

    // === 2. ANIMATION OFFSET CALCULATION ===
    let a_FL = [0,0], a_FR = [0,0], a_BL = [0,0], a_BR = [0,0];
    let a_head = 0, a_ear = 0, a_tail = 0, a_footL = 0, a_footR = 0;

    if (g_animationOn) {
        let t = g_seconds * 4;
        let amp = 20;
        
        // Calculate Deltas (Offsets)
        a_FL[0] = amp * Math.sin(t);
        a_FL[1] = 20 * (0.5 + 0.5 * Math.sin(t));
        
        a_BR[0] = amp * Math.sin(t);
        a_BR[1] = 20 * (0.5 + 0.5 * Math.sin(t));

        a_FR[0] = amp * Math.sin(t + Math.PI);
        a_FR[1] = 20 * (0.5 + 0.5 * Math.sin(t + Math.PI));
        
        a_BL[0] = amp * Math.sin(t + Math.PI);
        a_BL[1] = 20 * (0.5 + 0.5 * Math.sin(t + Math.PI));

        a_head = 5 * Math.sin(t*2);
        a_ear = 10 * Math.sin(t * 2);
        a_tail = 15 * Math.sin(t * 3);

        a_footL = 20 * Math.sin(t);
        a_footR = 20 * Math.sin(t + Math.PI);
    }

    // === 3. APPLY BASE + OFFSET TO RENDER VARIABLES ===
    // This allows sliders to control the "center" of the animation
    g_headAngle = g_head_base + a_head;
    g_earAngle = g_ear_base + a_ear;
    g_tailAngle = a_tail; // No base for tail
    
    g_FL[0] = g_FL_base[0] + a_FL[0];
    g_FL[1] = g_FL_base[1] + a_FL[1];
    
    g_FR[0] = g_FR_base[0] + a_FR[0];
    g_FR[1] = g_FR_base[1] + a_FR[1];
    
    g_BL[0] = g_BL_base[0] + a_BL[0];
    g_BL[1] = g_BL_base[1] + a_BL[1];
    
    g_BR[0] = g_BR_base[0] + a_BR[0];
    g_BR[1] = g_BR_base[1] + a_BR[1];

    g_footAngleL = g_footL_base + a_footL;
    g_footAngleR = g_footR_base + a_footR;
}

// --- Main Render ---

function renderScene() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let globalRot = new Matrix4()
        .rotate(g_globalAngleX, 1, 0, 0)
        .rotate(g_globalAngleY, 0, 1, 0);
    
    let baseScale = 0.6;
    let zoomScale = 1 + g_zoom/50;
    globalRot.scale(baseScale * zoomScale, baseScale * zoomScale, baseScale * zoomScale);
        
    gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, globalRot.elements);

    // --- COLORS ---
    const c_grey    = [0.60, 0.60, 0.60, 1.0];
    const c_dark    = [0.50, 0.50, 0.50, 1.0]; 
    const c_pink    = [1.0, 0.6, 0.7, 1.0];
    const c_white   = [0.95, 0.95, 0.95, 1.0];
    const c_black   = [0.1, 0.1, 0.1, 1.0];

    // Anchor
    let bodyCoord = new Matrix4();
    bodyCoord.translate(0, 0, 0);

    // === 1. BODY ===
    let bodyMat = new Matrix4(bodyCoord);
    bodyMat.translate(-0.5, -0.2 + g_mag, -0.25 + g_mag); 
    let expand = 1.0 + g_mag;
    bodyMat.scale(1.0 * expand, 0.45 * expand, 0.5 * expand); 
    drawCube(bodyMat, c_grey);

    // === 2. NECK ===
    let neckMat = new Matrix4(bodyCoord);
    neckMat.translate(-0.5, 0.25 + g_mag, -0.25); 
    neckMat.scale(0.25, 0.2, 0.5); 
    drawWedge(neckMat, c_grey);

    // === 3. HEAD ===
    let headBase = new Matrix4(bodyCoord);
    headBase.translate(-0.6 - g_mag, 0.45 + g_mag, 0); 
    headBase.rotate(g_headAngle, 0, 1, 0);

    // Main Head Box
    let headBox = new Matrix4(headBase);
    headBox.translate(-0.15, 0, -0.25);
    headBox.scale(0.35, 0.35, 0.5); 
    drawCube(headBox, c_grey);

    // Snout
    let snoutMat = new Matrix4(headBase);
    snoutMat.translate(-0.3, 0.0, -0.25); 
    snoutMat.scale(0.15, 0.15, 0.5); 
    drawCube(snoutMat, c_dark);

    // Nose
    let noseMat = new Matrix4(headBase);
    noseMat.translate(-0.31, 0.13, -0.05);
    noseMat.scale(0.04, 0.04, 0.1);
    drawCube(noseMat, c_pink);

    // Eyes
    let eyeL = new Matrix4(headBase);
    eyeL.translate(-0.05, 0.15, 0.255); 
    eyeL.scale(0.1, 0.1, 0.02);
    drawCube(eyeL, c_white);
    let pupL = new Matrix4(headBase);
    pupL.translate(-0.02, 0.17, 0.27);
    pupL.scale(0.05, 0.05, 0.02);
    drawCube(pupL, c_black);

    let eyeR = new Matrix4(headBase);
    eyeR.translate(-0.05, 0.15, -0.27); 
    eyeR.scale(0.1, 0.1, 0.02);
    drawCube(eyeR, c_white);
    let pupR = new Matrix4(headBase);
    pupR.translate(-0.02, 0.17, -0.28);
    pupR.scale(0.05, 0.05, 0.02);
    drawCube(pupR, c_black);

    // Ears
    let earL = new Matrix4(headBase);
    earL.translate(-0.05, 0.35, 0.1);
    // FLIPPED AXIS: (0, 0, 1)
    earL.rotate(g_earAngle, 0, 0, 1); 
    earL.scale(0.1, 0.5, 0.1);
    drawCube(earL, c_grey);
    let earLin = new Matrix4(earL);
    earLin.translate(-0.1, 0.1, -0.05); 
    earLin.scale(1.1, 0.8, 0.1);
    drawCube(earLin, c_pink);

    let earR = new Matrix4(headBase);
    earR.translate(-0.05, 0.35, -0.2);
    // FLIPPED AXIS: (0, 0, 1)
    earR.rotate(g_earAngle, 0, 0, 1); 
    earR.scale(0.1, 0.5, 0.1);
    drawCube(earR, c_grey);
    let earRin = new Matrix4(earR);
    earRin.translate(-0.1, 0.1, 0.95);
    earRin.scale(1.1, 0.8, 0.1);
    drawCube(earRin, c_pink);

    // === 4. TAIL ===
    let tailMat = new Matrix4(bodyCoord);
    tailMat.translate(0.5 + g_mag, 0.15, -0.05); 
    tailMat.rotate(g_tailAngle, 0, 1, 0); 
    tailMat.scale(0.2, 0.2, 0.2); 
    drawCube(tailMat, c_white);


    // === 5. LEGS ===
    
    // --- Front Left (3 Levels) ---
    let flBase = new Matrix4(bodyCoord);
    flBase.translate(-0.4 - g_mag, -0.15 - g_mag, 0.09 + g_mag); 
    flBase.rotate(g_FL[0], 0, 0, 1); 
    
    let flUpper = new Matrix4(flBase);
    flUpper.scale(0.15, -0.2, 0.15); 
    drawCube(flUpper, c_dark);
    
    let flLowBase = new Matrix4(flBase);
    flLowBase.translate(0, -0.2, 0); 
    flLowBase.rotate(g_FL[1], 0, 0, 1); 
    let flLower = new Matrix4(flLowBase);
    flLower.translate(0.005, 0, 0.005); 
    flLower.scale(0.14, -0.15, 0.14); 
    drawCube(flLower, c_dark);

    // Foot (Level 3)
    let flFootBase = new Matrix4(flLowBase);
    flFootBase.translate(0, -0.15, 0); 
    flFootBase.rotate(g_footAngleL, 0, 0, 1); 
    let flFoot = new Matrix4(flFootBase);
    flFoot.translate(0.01, 0, 0.01);
    flFoot.scale(0.13, -0.1, 0.13); 
    drawCube(flFoot, c_white);


    // --- Front Right (3 Levels) ---
    let frBase = new Matrix4(bodyCoord);
    frBase.translate(-0.4 - g_mag, -0.15 - g_mag, -0.24 - g_mag); 
    frBase.rotate(g_FR[0], 0, 0, 1);
    
    let frUpper = new Matrix4(frBase);
    frUpper.scale(0.15, -0.2, 0.15);
    drawCube(frUpper, c_dark);
    
    let frLowBase = new Matrix4(frBase);
    frLowBase.translate(0, -0.2, 0);
    frLowBase.rotate(g_FR[1], 0, 0, 1);
    let frLower = new Matrix4(frLowBase);
    frLower.translate(0.005, 0, 0.005);
    frLower.scale(0.14, -0.15, 0.14);
    drawCube(frLower, c_dark);

    let frFootBase = new Matrix4(frLowBase);
    frFootBase.translate(0, -0.15, 0);
    frFootBase.rotate(g_footAngleR, 0, 0, 1);
    let frFoot = new Matrix4(frFootBase);
    frFoot.translate(0.01, 0, 0.01);
    frFoot.scale(0.13, -0.1, 0.13);
    drawCube(frFoot, c_white);


    // --- Back Legs (2 Levels) ---
    // Back Left
    let blBase = new Matrix4(bodyCoord);
    blBase.translate(0.35 + g_mag, -0.1 - g_mag, 0.25 + g_mag); 
    blBase.rotate(g_BL[0], 0, 0, 1); 
    let blThigh = new Matrix4(blBase);
    blThigh.translate(-0.15, -0.35, -0.05); 
    blThigh.scale(0.3, 0.35, 0.25); 
    drawCube(blThigh, c_dark);

    let blFootBase = new Matrix4(blBase);
    blFootBase.translate(-0.1, -0.35, 0); 
    blFootBase.rotate(g_BL[1], 0, 0, 1); 
    let blFoot = new Matrix4(blFootBase);
    blFoot.translate(-0.05, -0.15, 0.05); 
    blFoot.scale(0.2, 0.15, 0.15); 
    drawCube(blFoot, c_white);

    // Back Right
    let brBase = new Matrix4(bodyCoord);
    brBase.translate(0.35 + g_mag, -0.1 - g_mag, -0.4 - g_mag); 
    brBase.rotate(g_BR[0], 0, 0, 1); 
    let brThigh = new Matrix4(brBase);
    brThigh.translate(-0.15, -0.35, -0.05);
    brThigh.scale(0.3, 0.35, 0.25); 
    drawCube(brThigh, c_dark);

    let brFootBase = new Matrix4(brBase);
    brFootBase.translate(-0.1, -0.35, 0); 
    brFootBase.rotate(g_BR[1], 0, 0, 1); 
    let brFoot = new Matrix4(brFootBase);
    brFoot.translate(-0.05, -0.15, 0.05); 
    brFoot.scale(0.2, 0.15, 0.15); 
    drawCube(brFoot, c_white);
}