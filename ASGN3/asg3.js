// ================= GLOBAL VARIABLES =================

// WebGL
let gl;
let canvas;
let a_Position, a_UV;
let u_FragColor, u_ModelMatrix, u_ProjectionMatrix, u_ViewMatrix;
let u_Sampler0, u_Sampler1, u_Sampler2, u_whichTexture;

// ASG3 World
let g_camera;
let g_map = [];

// Game Logic
let g_blocksPlaced = 0; // Track placed blocks for Day/Night cycle

// Texture Objects (Stored globally to swap sky)
let g_texSky = null;
let g_texSunset = null;
let g_texNight = null;

// Optimization: Shared Cube Instance
let g_sharedCube;

// Bunny Animation State
let g_animationOn = true; 
let g_mag = 0; 

// Bunny Render Values
let g_headAngle = 0;
let g_earAngle = 0;
let g_tailAngle = 0; 
let g_footAngleL = 0, g_footAngleR = 0;
let g_FL = [0, 0], g_FR = [0, 0], g_BL = [0, 0], g_BR = [0, 0]; 

// Bunny Base Values (Defaults)
let g_head_base = 0;
let g_ear_base = 0;
let g_footL_base = 0, g_footR_base = 0;
let g_FL_base = [0, 0], g_FR_base = [0, 0], g_BL_base = [0, 0], g_BR_base = [0, 0]; 

// Performance
let g_startTime = performance.now();
let g_seconds = 0;

// ================= SHADERS =================

const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec2 a_UV;
  varying vec2 v_UV;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;
    v_UV = a_UV;
  }
`;

const FSHADER_SOURCE = `
  precision mediump float;
  varying vec2 v_UV;
  uniform vec4 u_FragColor;
  uniform sampler2D u_Sampler0; // Sky (Dynamic)
  uniform sampler2D u_Sampler1; // Ground
  uniform sampler2D u_Sampler2; // Wall
  uniform int u_whichTexture;
  void main() {
    if (u_whichTexture == -2) {           // Solid Color
       gl_FragColor = u_FragColor;
    } else if (u_whichTexture == -1) {    // UV Debug
       gl_FragColor = vec4(v_UV, 1.0, 1.0);
    } else if (u_whichTexture == 0) {     // Sky
       gl_FragColor = texture2D(u_Sampler0, v_UV);
    } else if (u_whichTexture == 1) {     // Ground
       gl_FragColor = texture2D(u_Sampler1, v_UV);
    } else if (u_whichTexture == 2) {     // Wall
       gl_FragColor = texture2D(u_Sampler2, v_UV);
    } else {
       gl_FragColor = vec4(1,.2,.2,1);    // Error
    }
  }
`;

// ================= MAIN =================

function main() {
    setupWebGL();
    connectVariablesToGLSL();
    
    // UI & Controls Init
    document.onkeydown = keydown;
    initMouseControl();
    
    // Initialize Buffers (Optimized Geometry)
    // NOTE: Requires the updated Cube.js from the optimization step!
    if(typeof initCubeBuffer === 'function') {
        initCubeBuffer();
    } else {
        console.error("initCubeBuffer is missing! Make sure you updated Cube.js.");
    }

    // World Init
    g_camera = new Camera();
    g_sharedCube = new Cube(); // Pre-allocate one cube for reuse
    initTextures();
    initMap(); 

    requestAnimationFrame(tick);
}

function setupWebGL() {
    canvas = document.getElementById('webgl');
    gl = canvas.getContext("webgl", { preserveDrawingBuffer: true});
    if (!gl) { console.log('Failed to get the rendering context for WebGL'); return; }
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.0, 1.0);
}

function connectVariablesToGLSL() {
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) return;

    a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    a_UV = gl.getAttribLocation(gl.program, 'a_UV');
    u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
    u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
    u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
    u_Sampler0 = gl.getUniformLocation(gl.program, 'u_Sampler0');
    u_Sampler1 = gl.getUniformLocation(gl.program, 'u_Sampler1');
    u_Sampler2 = gl.getUniformLocation(gl.program, 'u_Sampler2');
    u_whichTexture = gl.getUniformLocation(gl.program, 'u_whichTexture');

    // Attach to GL program for easy access in classes
    gl.program.u_ModelMatrix = u_ModelMatrix;
    gl.program.u_FragColor = u_FragColor;
    gl.program.u_whichTexture = u_whichTexture;
}

// ================= TEXTURES & MAP =================

function initTextures() {
    // Helper to create texture object
    function createTexture(image, textureUnit, storeGlobal) {
        let texture = gl.createTexture();
        if(storeGlobal) {
            // Store reference to global variable based on name string
            if(storeGlobal === 'sky') g_texSky = texture;
            if(storeGlobal === 'sunset') g_texSunset = texture;
            if(storeGlobal === 'night') g_texNight = texture;
        }
        
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        
        // Bind to specific unit
        if (textureUnit == 0) { gl.activeTexture(gl.TEXTURE0); gl.uniform1i(u_Sampler0, 0); }
        else if (textureUnit == 1) { gl.activeTexture(gl.TEXTURE1); gl.uniform1i(u_Sampler1, 1); }
        else if (textureUnit == 2) { gl.activeTexture(gl.TEXTURE2); gl.uniform1i(u_Sampler2, 2); }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    }

    // Load Images
    let imgSky = new Image(); imgSky.onload = function() { createTexture(imgSky, 0, 'sky'); }; imgSky.src = 'sky.jpg';
    let imgSunset = new Image(); imgSunset.onload = function() { createTexture(imgSunset, -1, 'sunset'); }; imgSunset.src = 'sunset.jpg'; 
    let imgNight = new Image(); imgNight.onload = function() { createTexture(imgNight, -1, 'night'); }; imgNight.src = 'night.jpg';

    let imgDirt = new Image(); imgDirt.onload = function() { createTexture(imgDirt, 1, null); }; imgDirt.src = 'dirt.jpg';
    let imgWall = new Image(); imgWall.onload = function() { createTexture(imgWall, 2, null); }; imgWall.src = 'wall.jpg';
}

function initMap() {
    for (let x = 0; x < 32; x++) {
        g_map[x] = [];
        for (let z = 0; z < 32; z++) {
            
            // 1. CLEAR BUNNY AREA
            if ((x >= 15 && x <= 17) && (z >= 13 && z <= 15)) {
                g_map[x][z] = 0;
                continue; 
            }

            // 2. Borders
            if (x == 0 || x == 31 || z == 0 || z == 31) {
                g_map[x][z] = 3; 
            } 
            // 3. Random Walls
            else if (Math.random() > 0.9) {
                g_map[x][z] = Math.floor(Math.random() * 3) + 1;
            } else {
                g_map[x][z] = 0;
            }
        }
    }
}

// ================= CONTROLS =================

function keydown(ev) {
    if (ev.keyCode == 68) g_camera.moveRight(); // D
    if (ev.keyCode == 65) g_camera.moveLeft();  // A
    if (ev.keyCode == 87) g_camera.moveForward(); // W
    if (ev.keyCode == 83) g_camera.moveBackwards(); // S
    if (ev.keyCode == 81) g_camera.panLeft(); // Q
    if (ev.keyCode == 69) g_camera.panRight(); // E
}

function initMouseControl() {
    canvas.onclick = function() {
        if (!document.pointerLockElement) {
            canvas.requestPointerLock();
        }
    };

    document.addEventListener("mousemove", function(ev) {
        if (document.pointerLockElement === canvas) {
            let deltaX = ev.movementX;
            g_camera.pan(-deltaX * 0.2); 
        }
    });

    canvas.onmousedown = function(ev) {
        if (document.pointerLockElement === canvas) {
            if (ev.shiftKey) { 
               modifyBlock(0); // Delete
            } else {
               modifyBlock(1); // Add
            }
        }
    };
}

function modifyBlock(action) {
    let eye = g_camera.eye.elements;
    let at = g_camera.at.elements;

    let dx = at[0] - eye[0];
    let dy = at[1] - eye[1];
    let dz = at[2] - eye[2];

    let len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (len == 0) return; 

    let reach = 3.0;
    dx = (dx / len) * reach;
    dz = (dz / len) * reach;

    let tX = eye[0] + dx;
    let tZ = eye[2] + dz;

    let gridX = Math.floor(tX + 16);
    let gridZ = Math.floor(tZ + 16);

    // Collision Check
    if ((gridX >= 15 && gridX <= 17) && (gridZ >= 13 && gridZ <= 15)) {
        console.log("Cannot modify block occupied by the Bunny!");
        return; 
    }

    if (gridX >= 0 && gridX < 32 && gridZ >= 0 && gridZ < 32) {
         if (action == 0) {
             if(g_map[gridX][gridZ] > 0) {
                 g_map[gridX][gridZ] = 0; 
             }
         } else {
             if(g_map[gridX][gridZ] == 0) g_map[gridX][gridZ] = 1;
             else g_map[gridX][gridZ] += 1;
             
             // Increment Block Count
             g_blocksPlaced++;
         }
    }
}

// ================= RENDER LOOP =================

function tick() {
    g_seconds = (performance.now() - g_startTime) / 1000.0;
    updateBunnyAnimation();
    renderScene();
    requestAnimationFrame(tick);
}

function updateBunnyAnimation() {
    let a_FL = [0,0], a_FR = [0,0], a_BL = [0,0], a_BR = [0,0];
    let a_head = 0, a_ear = 0, a_tail = 0, a_footL = 0, a_footR = 0;

    let t = g_seconds * 4;
    a_FL[0] = 20 * Math.sin(t); a_FL[1] = 20 * (0.5 + 0.5 * Math.sin(t));
    a_BR[0] = 20 * Math.sin(t); a_BR[1] = 20 * (0.5 + 0.5 * Math.sin(t));
    a_FR[0] = 20 * Math.sin(t + Math.PI); a_FR[1] = 20 * (0.5 + 0.5 * Math.sin(t + Math.PI));
    a_BL[0] = 20 * Math.sin(t + Math.PI); a_BL[1] = 20 * (0.5 + 0.5 * Math.sin(t + Math.PI));
    a_head = 5 * Math.sin(t*2);
    a_ear = 10 * Math.sin(t * 2);
    a_tail = 15 * Math.sin(t * 3);
    a_footL = 20 * Math.sin(t);
    a_footR = 20 * Math.sin(t + Math.PI);

    g_headAngle = g_head_base + a_head;
    g_earAngle = g_ear_base + a_ear;
    g_tailAngle = a_tail;
    
    g_FL[0] = g_FL_base[0] + a_FL[0]; g_FL[1] = g_FL_base[1] + a_FL[1];
    g_FR[0] = g_FR_base[0] + a_FR[0]; g_FR[1] = g_FR_base[1] + a_FR[1];
    g_BL[0] = g_BL_base[0] + a_BL[0]; g_BL[1] = g_BL_base[1] + a_BL[1];
    g_BR[0] = g_BR_base[0] + a_BR[0]; g_BR[1] = g_BR_base[1] + a_BR[1];

    g_footAngleL = g_footL_base + a_footL;
    g_footAngleR = g_footR_base + a_footR;
}

function renderScene() {
    var startTime = performance.now();

    g_camera.updateMatrix();
    gl.uniformMatrix4fv(u_ViewMatrix, false, g_camera.viewMatrix.elements);
    gl.uniformMatrix4fv(u_ProjectionMatrix, false, g_camera.projectionMatrix.elements);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // --- DRAW SKY (Dynamic Texture based on g_blocksPlaced) ---
    // Decide which texture to use
    let currentSky = g_texSky; // Default
    if (g_blocksPlaced >= 10 && g_blocksPlaced < 15) {
        if(g_texSunset) currentSky = g_texSunset;
    } else if (g_blocksPlaced >= 15) {
        if(g_texNight) currentSky = g_texNight;
    }

    // Bind correct texture to Unit 0 before drawing Sky
    if(currentSky) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentSky);
    }
    
    g_sharedCube.color = [1,0,0,1];
    g_sharedCube.textureNum = 0; // Use Sampler0 (Unit 0)
    g_sharedCube.matrix.setIdentity();
    g_sharedCube.matrix.scale(100, 100, 100);
    g_sharedCube.matrix.translate(-0.5, -0.5, -0.5);
    g_sharedCube.drawCube(gl.program);


    // --- DRAW FLOOR ---
    g_sharedCube.textureNum = 1; 
    g_sharedCube.matrix.setIdentity();
    g_sharedCube.matrix.translate(0, -.75, 0);
    g_sharedCube.matrix.scale(32, 0, 32);
    g_sharedCube.matrix.translate(-0.5, 0, -0.5);
    g_sharedCube.drawCube(gl.program);

    // --- DRAW WALLS ---
    g_sharedCube.textureNum = 2; 
    for (let x = 0; x < 32; x++) {
        for (let z = 0; z < 32; z++) {
            let height = g_map[x][z];
            if (height > 0) {
                for (let k = 0; k < height; k++) {
                    g_sharedCube.matrix.setIdentity();
                    g_sharedCube.matrix.translate(x - 16, k - 0.75, z - 16); 
                    g_sharedCube.drawCube(gl.program);
                }
            }
        }
    }

    // --- DRAW BUNNY ---
    let bunnyMatrix = new Matrix4();
    bunnyMatrix.translate(0, -0.15, -2); 
    bunnyMatrix.rotate(180, 0, 1, 0);    
    renderBunny(bunnyMatrix);

    // Stats
    var duration = performance.now() - startTime;
    let fps = document.getElementById("performance");
    if(fps) fps.innerHTML = "fps: " + Math.floor(10000/duration)/10 + " | Blocks: " + g_blocksPlaced;
}

// ================= BUNNY RENDERER =================

function drawCubePlain(matrix, color) {
    g_sharedCube.color = color;
    g_sharedCube.matrix = matrix;
    g_sharedCube.textureNum = -2; // Solid color
    g_sharedCube.drawCube(gl.program);
}

function drawWedgePlain(matrix, color) {
    g_sharedCube.color = color;
    g_sharedCube.matrix = matrix;
    g_sharedCube.textureNum = -2; // Solid color
    g_sharedCube.drawWedge(gl.program);
}

function renderBunny(baseMatrix) {
    const c_grey    = [0.60, 0.60, 0.60, 1.0];
    const c_dark    = [0.50, 0.50, 0.50, 1.0]; 
    const c_pink    = [1.0, 0.6, 0.7, 1.0];
    const c_white   = [0.95, 0.95, 0.95, 1.0];
    const c_black   = [0.1, 0.1, 0.1, 1.0];

    // Root coordinate of the bunny body
    let bodyCoord = new Matrix4(baseMatrix);

    // 1. BODY
    let bodyMat = new Matrix4(bodyCoord);
    bodyMat.translate(-0.5, -0.2, -0.25); 
    bodyMat.scale(1.0, 0.45, 0.5); 
    drawCubePlain(bodyMat, c_grey);

    // 2. NECK (Wedge)
    let neckMat = new Matrix4(bodyCoord);
    neckMat.translate(-0.5, 0.25, -0.25); 
    neckMat.scale(0.25, 0.2, 0.5); 
    drawWedgePlain(neckMat, c_grey);

    // 3. HEAD
    let headBase = new Matrix4(bodyCoord);
    headBase.translate(-0.6, 0.45, 0); 
    headBase.rotate(g_headAngle, 0, 1, 0);

    // Head Box
    let headBox = new Matrix4(headBase);
    headBox.translate(-0.15, 0, -0.25);
    headBox.scale(0.35, 0.35, 0.5); 
    drawCubePlain(headBox, c_grey);

    // Snout
    let snoutMat = new Matrix4(headBase);
    snoutMat.translate(-0.3, 0.0, -0.25); 
    snoutMat.scale(0.15, 0.15, 0.5); 
    drawCubePlain(snoutMat, c_dark);

    // Nose
    let noseMat = new Matrix4(headBase);
    noseMat.translate(-0.31, 0.13, -0.05);
    noseMat.scale(0.04, 0.04, 0.1);
    drawCubePlain(noseMat, c_pink);

    // Eyes
    let eyeL = new Matrix4(headBase);
    eyeL.translate(-0.05, 0.15, 0.255); eyeL.scale(0.1, 0.1, 0.02);
    drawCubePlain(eyeL, c_white);
    let pupL = new Matrix4(headBase);
    pupL.translate(-0.02, 0.17, 0.27); pupL.scale(0.05, 0.05, 0.02);
    drawCubePlain(pupL, c_black);

    let eyeR = new Matrix4(headBase);
    eyeR.translate(-0.05, 0.15, -0.27); eyeR.scale(0.1, 0.1, 0.02);
    drawCubePlain(eyeR, c_white);
    let pupR = new Matrix4(headBase);
    pupR.translate(-0.02, 0.17, -0.28); pupR.scale(0.05, 0.05, 0.02);
    drawCubePlain(pupR, c_black);

    // Ears
    let earL = new Matrix4(headBase);
    earL.translate(-0.05, 0.35, 0.1); earL.rotate(g_earAngle, 0, 0, 1); earL.scale(0.1, 0.5, 0.1);
    drawCubePlain(earL, c_grey);
    let earLin = new Matrix4(earL);
    earLin.translate(-0.1, 0.1, -0.05); earLin.scale(1.1, 0.8, 0.1);
    drawCubePlain(earLin, c_pink);

    let earR = new Matrix4(headBase);
    earR.translate(-0.05, 0.35, -0.2); earR.rotate(g_earAngle, 0, 0, 1); earR.scale(0.1, 0.5, 0.1);
    drawCubePlain(earR, c_grey);
    let earRin = new Matrix4(earR);
    earRin.translate(-0.1, 0.1, 0.95); earRin.scale(1.1, 0.8, 0.1);
    drawCubePlain(earRin, c_pink);

    // 4. TAIL
    let tailMat = new Matrix4(bodyCoord);
    tailMat.translate(0.5, 0.15, -0.05); 
    tailMat.rotate(g_tailAngle, 0, 1, 0); 
    tailMat.scale(0.2, 0.2, 0.2); 
    drawCubePlain(tailMat, c_white);

    // 5. LEGS (Front Left)
    let flBase = new Matrix4(bodyCoord);
    flBase.translate(-0.4, -0.15, 0.09); 
    flBase.rotate(g_FL[0], 0, 0, 1); 
    let flUpper = new Matrix4(flBase);
    flUpper.scale(0.15, -0.2, 0.15); 
    drawCubePlain(flUpper, c_dark);
    
    let flLowBase = new Matrix4(flBase);
    flLowBase.translate(0, -0.2, 0); flLowBase.rotate(g_FL[1], 0, 0, 1); 
    let flLower = new Matrix4(flLowBase);
    flLower.translate(0.005, 0, 0.005); flLower.scale(0.14, -0.15, 0.14); 
    drawCubePlain(flLower, c_dark);

    let flFootBase = new Matrix4(flLowBase);
    flFootBase.translate(0, -0.15, 0); flFootBase.rotate(g_footAngleL, 0, 0, 1); 
    let flFoot = new Matrix4(flFootBase);
    flFoot.translate(0.01, 0, 0.01); flFoot.scale(0.13, -0.1, 0.13); 
    drawCubePlain(flFoot, c_white);

    // Front Right
    let frBase = new Matrix4(bodyCoord);
    frBase.translate(-0.4, -0.15, -0.24); 
    frBase.rotate(g_FR[0], 0, 0, 1);
    let frUpper = new Matrix4(frBase);
    frUpper.scale(0.15, -0.2, 0.15);
    drawCubePlain(frUpper, c_dark);
    
    let frLowBase = new Matrix4(frBase);
    frLowBase.translate(0, -0.2, 0); frLowBase.rotate(g_FR[1], 0, 0, 1);
    let frLower = new Matrix4(frLowBase);
    frLower.translate(0.005, 0, 0.005); frLower.scale(0.14, -0.15, 0.14);
    drawCubePlain(frLower, c_dark);

    let frFootBase = new Matrix4(frLowBase);
    frFootBase.translate(0, -0.15, 0); frFootBase.rotate(g_footAngleR, 0, 0, 1);
    let frFoot = new Matrix4(frFootBase);
    frFoot.translate(0.01, 0, 0.01); frFoot.scale(0.13, -0.1, 0.13);
    drawCubePlain(frFoot, c_white);

    // Back Left
    let blBase = new Matrix4(bodyCoord);
    blBase.translate(0.35, -0.1, 0.25); 
    blBase.rotate(g_BL[0], 0, 0, 1); 
    let blThigh = new Matrix4(blBase);
    blThigh.translate(-0.15, -0.35, -0.05); blThigh.scale(0.3, 0.35, 0.25); 
    drawCubePlain(blThigh, c_dark);

    let blFootBase = new Matrix4(blBase);
    blFootBase.translate(-0.1, -0.35, 0); blFootBase.rotate(g_BL[1], 0, 0, 1); 
    let blFoot = new Matrix4(blFootBase);
    blFoot.translate(-0.05, -0.15, 0.05); blFoot.scale(0.2, 0.15, 0.15); 
    drawCubePlain(blFoot, c_white);

    // Back Right
    let brBase = new Matrix4(bodyCoord);
    brBase.translate(0.35, -0.1, -0.4); 
    brBase.rotate(g_BR[0], 0, 0, 1); 
    let brThigh = new Matrix4(brBase);
    brThigh.translate(-0.15, -0.35, -0.05); brThigh.scale(0.3, 0.35, 0.25); 
    drawCubePlain(brThigh, c_dark);

    let brFootBase = new Matrix4(brBase);
    brFootBase.translate(-0.1, -0.35, 0); brFootBase.rotate(g_BR[1], 0, 0, 1); 
    let brFoot = new Matrix4(brFootBase);
    brFoot.translate(-0.05, -0.15, 0.05); brFoot.scale(0.2, 0.15, 0.15); 
    drawCubePlain(brFoot, c_white);
}