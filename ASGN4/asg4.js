// ================= SHADERS =================

// Vertex Shader
const VSHADER_SOURCE = `
    attribute vec4 a_Position;
    attribute vec3 a_Normal;
    
    uniform mat4 u_ModelMatrix;
    uniform mat4 u_GlobalRotateMatrix;
    uniform mat4 u_ViewMatrix;
    uniform mat4 u_ProjectionMatrix;
    uniform mat4 u_NormalMatrix;

    varying vec3 v_Normal;
    varying vec3 v_WorldPos;

    void main() {
        // 1. Calculate world position (Model * Local)
        vec4 worldPos = u_ModelMatrix * a_Position;
        v_WorldPos = worldPos.xyz;

        // 2. Transform normal to world space
        v_Normal = normalize(vec3(u_NormalMatrix * vec4(a_Normal, 0.0)));

        // 3. Final screen position
        gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_GlobalRotateMatrix * worldPos;
    }
`;

// Fragment Shader
const FSHADER_SOURCE = `
    precision mediump float;

    uniform vec4 u_FragColor;       // Base object color
    uniform vec3 u_LightPos;        // Light World Position
    uniform vec3 u_CameraPos;       // Camera World Position
    uniform vec3 u_LightColor;      // Light RGB
    
    // RENDER MODES: 0=Normals, 1=Lighting, 2=Solid Color
    uniform int u_RenderMode; 
    
    uniform bool u_SpotlightOn;

    varying vec3 v_Normal;
    varying vec3 v_WorldPos;

    void main() {
        // 1. Setup Vectors
        vec3 normal = normalize(v_Normal);
        vec3 lightDir = normalize(u_LightPos - v_WorldPos);
        vec3 viewDir = normalize(u_CameraPos - v_WorldPos);
        vec3 reflectDir = reflect(-lightDir, normal);
        
        // 2. Spotlight Logic
        float spotFactor = 1.0; 
        if (u_SpotlightOn) {
            vec3 spotDir = normalize(vec3(0.0, -1.0, -0.2)); 
            float theta = dot(lightDir, normalize(-spotDir));
            float cutoff = 0.90; 
            
            if(theta < cutoff) { 
                spotFactor = 0.0; 
            }
        }

        // --- MODE 2: SOLID COLOR (Unlit) ---
        if (u_RenderMode == 2) {
            gl_FragColor = u_FragColor;
            return;
        }

        // --- DETERMINE BASE COLOR ---
        vec3 baseColor;
        if (u_RenderMode == 0) {
            // Mode 0: Base color is the Normal Vector (Rainbow)
            baseColor = (normal + 1.0) / 2.0;
        } else {
            // Mode 1: Base color is the Object Color (White/Grey/etc)
            baseColor = u_FragColor.rgb;
        }

        // --- PHONG LIGHTING CALCULATION ---
        
        // Ambient
        float ambientStrength = 0.25;
        vec3 ambient = ambientStrength * u_LightColor;

        // Diffuse
        float diff = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = diff * u_LightColor * spotFactor;

        // Specular
        float specularStrength = 0.8;
        float shininess = 64.0;
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
        vec3 specular = specularStrength * spec * u_LightColor * spotFactor;

        // Combine Lighting with the selected Base Color
        vec3 finalColor = (ambient + diffuse) * baseColor + specular;
        
        gl_FragColor = vec4(finalColor, u_FragColor.a);
    }
`;

// ================= MODEL CLASS (Integrated) =================
class Model {
    constructor(gl, filePath, color) {
        this.filePath = filePath;
        this.color = color || [1.0, 1.0, 1.0, 1.0];
        this.matrix = new Matrix4();
        this.isFullyLoaded = false;
        this.gl = gl; 

        this.vertexBuffer = gl.createBuffer();
        this.normalBuffer = gl.createBuffer();
        this.vertexCount = 0;

        this.getFileContent();
    }

    async getFileContent() {
        try {
            const response = await fetch(this.filePath);
            if (!response.ok) throw new Error(`Could not load file "${this.filePath}"`);
            const fileContent = await response.text();
            this.parseModel(fileContent);
        } catch (e) {
            console.error(e);
        }
    }

    parseModel(fileContent) {
        const lines = fileContent.split("\n");
        const allVertices = [];
        const allNormals = [];
        const unpackedVerts = [];
        const unpackedNormals = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if(line.startsWith("#") || line === "") continue;

            const tokens = line.split(/\s+/);

            if (tokens[0] == "v") {
                allVertices.push(parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3]));
            } else if (tokens[0] == "vn") {
                allNormals.push(parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3]));
            } else if (tokens[0] == "f") {
                for (let j = 1; j <= 3; j++) {
                    const faceToken = tokens[j];
                    const indices = faceToken.split("//");
                    const vIndex = (parseInt(indices[0]) - 1) * 3;
                    const nIndex = (parseInt(indices[1]) - 1) * 3;

                    unpackedVerts.push(allVertices[vIndex], allVertices[vIndex+1], allVertices[vIndex+2]);
                    if (!isNaN(nIndex) && nIndex < allNormals.length * 3) {
                        unpackedNormals.push(allNormals[nIndex], allNormals[nIndex+1], allNormals[nIndex+2]);
                    } else {
                        unpackedNormals.push(0, 1, 0);
                    }
                }
            }
        }

        const vertices = new Float32Array(unpackedVerts);
        const normals = new Float32Array(unpackedNormals);
        this.vertexCount = vertices.length / 3;

        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

        this.isFullyLoaded = true;
    }

    render() {
        if (!this.isFullyLoaded) return;
        
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Normal);

        let normalMatrix = new Matrix4();
        normalMatrix.setInverseOf(this.matrix);
        normalMatrix.transpose();

        gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);
        gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
        gl.uniform4fv(u_FragColor, this.color);

        gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    }
}

// ================= GLOBAL VARIABLES =================
let canvas, gl;
let a_Position, a_Normal;
let u_ModelMatrix, u_GlobalRotateMatrix, u_ViewMatrix, u_ProjectionMatrix, u_NormalMatrix;
let u_FragColor, u_LightPos, u_CameraPos, u_LightColor, u_RenderMode, u_SpotlightOn;

let g_cubeBuffer, g_cubeNormalBuffer;
let g_wedgeBuffer, g_wedgeNormalBuffer;
let g_sphereBuffer, g_sphereNormalBuffer, g_sphereVertCount;

let g_objModel = null;
let g_globalAngleX = 0, g_globalAngleY = 0, g_zoom = 0;
let g_lightPos = [0, 2.5, 2.0];
let g_lightColor = [1.0, 1.0, 1.0];

let g_normalOn = false;
let g_lightOn = true;
let g_isSpotlightOn = false;
let g_animateLight = false;

// Animation Vars
let g_headAngle=0, g_earAngle=0, g_tailAngle=0, g_footAngleL=0, g_footAngleR=0;
let g_FL=[0,0], g_FR=[0,0], g_BL=[0,0], g_BR=[0,0];
let g_head_base=0, g_ear_base=0, g_footL_base=0, g_footR_base=0;
let g_FL_base=[0,0], g_FR_base=[0,0], g_BL_base=[0,0], g_BR_base=[0,0];
let g_animationOn=false, g_pokeAnimation=false, g_pokeTime=0, g_mag=0;
let g_startTime=performance.now(), g_seconds=0;
let g_fpsCounter=0, g_lastFpsTime=0;

// ================= MAIN =================
function main() {
    canvas = document.getElementById('webgl');
    gl = getWebGLContext(canvas);
    if (!gl) { console.log('Failed to get WebGL context'); return; }

    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) return;

    a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
    u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    u_GlobalRotateMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotateMatrix');
    u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
    u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
    u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
    u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
    u_LightPos = gl.getUniformLocation(gl.program, 'u_LightPos');
    u_CameraPos = gl.getUniformLocation(gl.program, 'u_CameraPos');
    u_LightColor = gl.getUniformLocation(gl.program, 'u_LightColor');
    u_RenderMode = gl.getUniformLocation(gl.program, 'u_RenderMode');
    u_SpotlightOn = gl.getUniformLocation(gl.program, 'u_SpotlightOn');

    initVertexBuffers(gl);

    // Load Bunny.Obj with White color
    g_objModel = new Model(gl, "bunny.obj", [1.0, 1.0, 1.0, 1.0]); 

    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.enable(gl.DEPTH_TEST);
    setupUI();
    requestAnimationFrame(tick);
}

function initVertexBuffers(gl) {
    // 1. CUBE
    const cubeVerts = new Float32Array([
        0,0,1, 1,1,1, 0,1,1,  0,0,1, 1,0,1, 1,1,1, 
        0,0,0, 0,1,0, 1,1,0,  0,0,0, 1,1,0, 1,0,0, 
        0,1,0, 0,1,1, 1,1,1,  0,1,0, 1,1,1, 1,1,0, 
        0,0,0, 1,0,0, 1,0,1,  0,0,0, 1,0,1, 0,0,1, 
        1,0,0, 1,1,0, 1,1,1,  1,0,0, 1,1,1, 1,0,1, 
        0,0,0, 0,0,1, 0,1,1,  0,0,0, 0,1,1, 0,1,0  
    ]);
    const cubeNormals = new Float32Array([
        0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,0,1,
        0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
        0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0,
        0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
        1,0,0, 1,0,0, 1,0,0, 1,0,0, 1,0,0, 1,0,0,
        -1,0,0, -1,0,0, -1,0,0, -1,0,0, -1,0,0, -1,0,0
    ]);
    g_cubeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeVerts, gl.STATIC_DRAW);
    g_cubeNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeNormals, gl.STATIC_DRAW);

    // 2. WEDGE
    const wedgeVerts = new Float32Array([
        0,0,0, 1,0,0, 0,1,0,  
        0,0,1, 0,1,1, 1,0,1,  
        0,0,0, 0,0,1, 1,0,1,   0,0,0, 1,0,1, 1,0,0,
        0,0,0, 0,1,0, 0,1,1,   0,0,0, 0,1,1, 0,0,1,
        1,0,0, 1,0,1, 0,1,1,   1,0,0, 0,1,1, 0,1,0
    ]);
    const invSqrt2 = 1.0 / Math.sqrt(2);
    const wedgeNormals = new Float32Array([
        0,0,-1, 0,0,-1, 0,0,-1, 
        0,0,1, 0,0,1, 0,0,1,    
        0,-1,0, 0,-1,0, 0,-1,0,  0,-1,0, 0,-1,0, 0,-1,0,
        -1,0,0, -1,0,0, -1,0,0,  -1,0,0, -1,0,0, -1,0,0,
        invSqrt2,invSqrt2,0, invSqrt2,invSqrt2,0, invSqrt2,invSqrt2,0,
        invSqrt2,invSqrt2,0, invSqrt2,invSqrt2,0, invSqrt2,invSqrt2,0 
    ]);
    g_wedgeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_wedgeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, wedgeVerts, gl.STATIC_DRAW);
    g_wedgeNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_wedgeNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, wedgeNormals, gl.STATIC_DRAW);

    // 3. SPHERE
    let spherePos = [], sphereNorm = [];
    let div = 25;
    for(let j=0; j<=div; j++) {
        let aj = j * Math.PI / div;
        let sj = Math.sin(aj), cj = Math.cos(aj);
        for(let i=0; i<=div; i++) {
            let ai = i * 2 * Math.PI / div;
            let si = Math.sin(ai), ci = Math.cos(ai);
            let x = si * sj, y = cj, z = ci * sj;
            spherePos.push(x, y, z);
            sphereNorm.push(x, y, z);
        }
    }
    let spherePosU = [], sphereNormU = [];
    for(let j=0; j<div; j++) {
        for(let i=0; i<div; i++) {
            let p1 = j*(div+1)+i, p2 = p1+(div+1);
            let idxs = [p1, p2, p1+1, p1+1, p2, p2+1];
            for(let k of idxs) {
                spherePosU.push(spherePos[k*3], spherePos[k*3+1], spherePos[k*3+2]);
                sphereNormU.push(sphereNorm[k*3], sphereNorm[k*3+1], sphereNorm[k*3+2]);
            }
        }
    }
    g_sphereVertCount = spherePosU.length / 3;
    g_sphereBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_sphereBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spherePosU), gl.STATIC_DRAW);
    g_sphereNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_sphereNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereNormU), gl.STATIC_DRAW);
}

// ================= DRAW HELPERS =================
function drawMesh(vertexBuffer, normalBuffer, count) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Normal);
    gl.drawArrays(gl.TRIANGLES, 0, count);
}
function drawCube(M, color) {
    let normalMatrix = new Matrix4();
    normalMatrix.setInverseOf(M);
    normalMatrix.transpose();
    gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);
    gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
    gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
    drawMesh(g_cubeBuffer, g_cubeNormalBuffer, 36);
}
function drawWedge(M, color) {
    let normalMatrix = new Matrix4();
    normalMatrix.setInverseOf(M);
    normalMatrix.transpose();
    gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);
    gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
    gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
    drawMesh(g_wedgeBuffer, g_wedgeNormalBuffer, 24);
}
function drawSphere(M, color) {
    let normalMatrix = new Matrix4();
    normalMatrix.setInverseOf(M);
    normalMatrix.transpose();
    gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);
    gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
    gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
    drawMesh(g_sphereBuffer, g_sphereNormalBuffer, g_sphereVertCount);
}

// ================= RENDER LOOP =================
function tick() {
    g_seconds = (performance.now() - g_startTime) / 1000.0;
    updateAnimation();
    renderScene();
    
    g_fpsCounter++;
    let now = performance.now();
    if(now - g_lastFpsTime >= 1000) {
        let fpsElem = document.getElementById('fps');
        if(fpsElem) fpsElem.innerText = "FPS: " + g_fpsCounter;
        g_fpsCounter = 0;
        g_lastFpsTime = now;
    }
    requestAnimationFrame(tick);
}

function updateAnimation() {
    if(g_animateLight) {
        g_lightPos[0] = Math.cos(g_seconds) * 3;
        g_lightPos[2] = Math.sin(g_seconds) * 3;
        let sX = document.getElementById('lightX');
        let sZ = document.getElementById('lightZ');
        if(sX) sX.value = g_lightPos[0] * 100;
        if(sZ) sZ.value = g_lightPos[2] * 100;
    }

    if (g_pokeAnimation) {
        let dt = g_seconds - g_pokeTime;
        if(dt > 2.0) { g_pokeAnimation = false; g_mag = 0; } 
        else {
            g_mag = 5.0 * (1 - Math.exp(-3 * dt));
            g_headAngle = 0; g_earAngle = 0; g_tailAngle = 0;
            g_FL = [0,0]; g_FR = [0,0]; g_BL = [0,0]; g_BR = [0,0];
            return; 
        }
    } else {
        if (g_mag > 0.01) g_mag *= 0.9; else g_mag = 0;
    }

    let a_FL = [0,0], a_FR = [0,0], a_BL = [0,0], a_BR = [0,0];
    let a_head = 0, a_ear = 0, a_tail = 0, a_footL = 0, a_footR = 0;

    // Standard bunny animation
    if (g_animationOn) {
        let t = g_seconds * 4;
        a_FL[0] = 20 * Math.sin(t); a_FL[1] = 20 * (0.5 + 0.5 * Math.sin(t));
        a_BR[0] = 20 * Math.sin(t); a_BR[1] = 20 * (0.5 + 0.5 * Math.sin(t));
        a_FR[0] = 20 * Math.sin(t + Math.PI); a_FR[1] = 20 * (0.5 + 0.5 * Math.sin(t + Math.PI));
        a_BL[0] = 20 * Math.sin(t + Math.PI); a_BL[1] = 20 * (0.5 + 0.5 * Math.sin(t + Math.PI));
        a_head = 5 * Math.sin(t*2); a_ear = 10 * Math.sin(t * 2); a_tail = 15 * Math.sin(t * 3);
        a_footL = 20 * Math.sin(t); a_footR = 20 * Math.sin(t + Math.PI);
    }

    g_headAngle = g_head_base + a_head;
    g_earAngle = g_ear_base + a_ear;
    g_tailAngle = a_tail;
    g_FL[0] = g_FL_base[0] + a_FL[0]; g_FL[1] = g_FL_base[1] + a_FL[1];
    g_FR[0] = g_FR_base[0] + a_FR[0]; g_FR[1] = g_FR_base[1] + a_FR[1];
    g_BL[0] = g_BL_base[0] + a_BL[0]; g_BL[1] = g_BL_base[1] + a_BL[1];
    g_BR[0] = g_BR_base[0] + a_BR[0]; g_BR[1] = g_BR_base[1] + a_BR[1];
    g_footAngleL = g_footL_base + a_footL; g_footAngleR = g_footR_base + a_footR;
}

function renderScene() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let projMat = new Matrix4();
    projMat.setPerspective(60, canvas.width/canvas.height, 0.1, 100);
    gl.uniformMatrix4fv(u_ProjectionMatrix, false, projMat.elements);

    let viewMat = new Matrix4();
    viewMat.setLookAt(0, 0, 5,  0, 0, 0,  0, 1, 0); 
    gl.uniformMatrix4fv(u_ViewMatrix, false, viewMat.elements);

    let globalRot = new Matrix4().rotate(g_globalAngleX, 1, 0, 0).rotate(g_globalAngleY, 0, 1, 0);
    let zoomScale = 1 + g_zoom/50;
    globalRot.scale(zoomScale, zoomScale, zoomScale);
    gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, globalRot.elements);

    // Light Uniforms
    gl.uniform3f(u_LightPos, g_lightPos[0], g_lightPos[1], g_lightPos[2]);
    gl.uniform3f(u_LightColor, g_lightColor[0], g_lightColor[1], g_lightColor[2]);
    gl.uniform3f(u_CameraPos, 0, 0, 5); 
    
    // DETERMINE RENDER MODE (Priority Logic)
    let mode = 2; // Default to solid/off
    if (g_normalOn) {
        mode = 0; // Normals take priority
    } else if (g_lightOn) {
        mode = 1; // Lighting active if normals are off
    }
    
    gl.uniform1i(u_RenderMode, mode); 
    gl.uniform1i(u_SpotlightOn, g_isSpotlightOn);

    // Light Marker (Always Solid)
    let lightMat = new Matrix4();
    lightMat.translate(g_lightPos[0], g_lightPos[1], g_lightPos[2]);
    lightMat.scale(0.1, 0.1, 0.1);
    gl.uniform1i(u_RenderMode, 2); 
    drawCube(lightMat, [1,1,0,1]); // Yellow
    gl.uniform1i(u_RenderMode, mode); // Restore

    // Floor
    let floorMat = new Matrix4();
    floorMat.translate(-10, -0.75, -10);
    floorMat.scale(20, 0.01, 20);
    drawCube(floorMat, [0.3, 0.3, 0.3, 1.0]);

    // Sphere (Right side, lowered)
    let sphMat = new Matrix4();
    sphMat.translate(2.0, -0.051, 0); 
    sphMat.scale(0.7, 0.7, 0.7);
    drawSphere(sphMat, [0.0, 0.8, 0.8, 1.0]); 
    
    // Loaded OBJ Bunny (Left side, lowered)
    if(g_objModel && g_objModel.isFullyLoaded) {
        g_objModel.matrix.setTranslate(-1.2, -1.028, 0.0); 
        // No Rotation applied here
        g_objModel.matrix.scale(0.35, 0.35, 0.35); 
        g_objModel.render();
    }

    // Cube Animal (Center)
    renderBunny();
}

function renderBunny() {
    const c_body = [0.6, 0.6, 0.7, 1.0], c_snout = [0.5, 0.5, 0.6, 1.0]; 
    const c_pink = [1.0, 0.6, 0.7, 1.0], c_white = [0.95, 0.95, 0.95, 1.0], c_black = [0.1, 0.1, 0.1, 1.0];
    
    // Adjusted Body Anchor to move animal down
    let bodyCoord = new Matrix4(); 
    bodyCoord.translate(0, -0.14, 0); 

    let bodyMat = new Matrix4(bodyCoord);
    bodyMat.translate(-0.5, -0.2 + g_mag, -0.25 + g_mag); 
    let expand = 1.0 + g_mag;
    bodyMat.scale(1.0 * expand, 0.45 * expand, 0.5 * expand); 
    drawCube(bodyMat, c_body);

    let neckMat = new Matrix4(bodyCoord);
    neckMat.translate(-0.5, 0.25 + g_mag, -0.25); neckMat.scale(0.25, 0.2, 0.5); 
    drawWedge(neckMat, c_body);

    let headBase = new Matrix4(bodyCoord);
    headBase.translate(-0.6 - g_mag, 0.45 + g_mag, 0); headBase.rotate(g_headAngle, 0, 1, 0);
    let headBox = new Matrix4(headBase); headBox.translate(-0.15, 0, -0.25); headBox.scale(0.35, 0.35, 0.5); 
    drawCube(headBox, c_body);
    let snoutMat = new Matrix4(headBase); snoutMat.translate(-0.3, 0.0, -0.25); snoutMat.scale(0.15, 0.15, 0.5); 
    drawCube(snoutMat, c_snout);
    let noseMat = new Matrix4(headBase); noseMat.translate(-0.31, 0.13, -0.05); noseMat.scale(0.04, 0.04, 0.1);
    drawCube(noseMat, c_pink);

    let eyeL = new Matrix4(headBase); eyeL.translate(-0.05, 0.15, 0.255); eyeL.scale(0.1, 0.1, 0.02); drawCube(eyeL, c_white);
    let pupL = new Matrix4(headBase); pupL.translate(-0.02, 0.17, 0.27); pupL.scale(0.05, 0.05, 0.02); drawCube(pupL, c_black);
    let eyeR = new Matrix4(headBase); eyeR.translate(-0.05, 0.15, -0.27); eyeR.scale(0.1, 0.1, 0.02); drawCube(eyeR, c_white);
    let pupR = new Matrix4(headBase); pupR.translate(-0.02, 0.17, -0.28); pupR.scale(0.05, 0.05, 0.02); drawCube(pupR, c_black);

    let earL = new Matrix4(headBase); earL.translate(-0.05, 0.35, 0.1); earL.rotate(g_earAngle, 0, 0, 1); earL.scale(0.1, 0.5, 0.1); drawCube(earL, c_body);
    let earLin = new Matrix4(earL); earLin.translate(-0.1, 0.1, -0.05); earLin.scale(1.1, 0.8, 0.1); drawCube(earLin, c_pink);
    let earR = new Matrix4(headBase); earR.translate(-0.05, 0.35, -0.2); earR.rotate(g_earAngle, 0, 0, 1); earR.scale(0.1, 0.5, 0.1); drawCube(earR, c_body);
    let earRin = new Matrix4(earR); earRin.translate(-0.1, 0.1, 0.95); earRin.scale(1.1, 0.8, 0.1); drawCube(earRin, c_pink);

    let tailMat = new Matrix4(bodyCoord); tailMat.translate(0.5 + g_mag, 0.15, -0.05); tailMat.rotate(g_tailAngle, 0, 1, 0); tailMat.scale(0.2, 0.2, 0.2); drawCube(tailMat, c_white);

    let flBase = new Matrix4(bodyCoord); flBase.translate(-0.4 - g_mag, -0.15 - g_mag, 0.09 + g_mag); flBase.rotate(g_FL[0], 0, 0, 1); 
    let flUpper = new Matrix4(flBase); flUpper.scale(0.15, -0.2, 0.15); drawCube(flUpper, c_body);
    let flLowBase = new Matrix4(flBase); flLowBase.translate(0, -0.2, 0); flLowBase.rotate(g_FL[1], 0, 0, 1); 
    let flLower = new Matrix4(flLowBase); flLower.translate(0.005, 0, 0.005); flLower.scale(0.14, -0.15, 0.14); drawCube(flLower, c_body);
    let flFootBase = new Matrix4(flLowBase); flFootBase.translate(0, -0.15, 0); flFootBase.rotate(g_footAngleL, 0, 0, 1); 
    let flFoot = new Matrix4(flFootBase); flFoot.translate(0.01, 0, 0.01); flFoot.scale(0.13, -0.1, 0.13); drawCube(flFoot, c_white);

    let frBase = new Matrix4(bodyCoord); frBase.translate(-0.4 - g_mag, -0.15 - g_mag, -0.24 - g_mag); frBase.rotate(g_FR[0], 0, 0, 1);
    let frUpper = new Matrix4(frBase); frUpper.scale(0.15, -0.2, 0.15); drawCube(frUpper, c_body);
    let frLowBase = new Matrix4(frBase); frLowBase.translate(0, -0.2, 0); frLowBase.rotate(g_FR[1], 0, 0, 1);
    let frLower = new Matrix4(frLowBase); frLower.translate(0.005, 0, 0.005); frLower.scale(0.14, -0.15, 0.14); drawCube(frLower, c_body);
    let frFootBase = new Matrix4(frLowBase); frFootBase.translate(0, -0.15, 0); frFootBase.rotate(g_footAngleR, 0, 0, 1);
    let frFoot = new Matrix4(frFootBase); frFoot.translate(0.01, 0, 0.01); frFoot.scale(0.13, -0.1, 0.13); drawCube(frFoot, c_white);

    let blBase = new Matrix4(bodyCoord); blBase.translate(0.35 + g_mag, -0.1 - g_mag, 0.25 + g_mag); blBase.rotate(g_BL[0], 0, 0, 1); 
    let blThigh = new Matrix4(blBase); blThigh.translate(-0.15, -0.35, -0.05); blThigh.scale(0.3, 0.35, 0.25); drawCube(blThigh, c_body);
    let blFootBase = new Matrix4(blBase); blFootBase.translate(-0.1, -0.35, 0); blFootBase.rotate(g_BL[1], 0, 0, 1); 
    let blFoot = new Matrix4(blFootBase); blFoot.translate(-0.05, -0.15, 0.05); blFoot.scale(0.2, 0.15, 0.15); drawCube(blFoot, c_white);

    let brBase = new Matrix4(bodyCoord); brBase.translate(0.35 + g_mag, -0.1 - g_mag, -0.4 - g_mag); brBase.rotate(g_BR[0], 0, 0, 1); 
    let brThigh = new Matrix4(brBase); brThigh.translate(-0.15, -0.35, -0.05); brThigh.scale(0.3, 0.35, 0.25); drawCube(brThigh, c_body);
    let brFootBase = new Matrix4(brBase); brFootBase.translate(-0.1, -0.35, 0); brFootBase.rotate(g_BR[1], 0, 0, 1); 
    let brFoot = new Matrix4(brFootBase); brFoot.translate(-0.05, -0.15, 0.05); brFoot.scale(0.2, 0.15, 0.15); drawCube(brFoot, c_white);
}

// ================= UI SETUP =================
function setupUI() {
    let ay = document.getElementById('angleY'); if(ay) ay.oninput = function() { g_globalAngleY = this.value; };
    let ax = document.getElementById('angleX'); if(ax) ax.oninput = function() { g_globalAngleX = this.value; };
    let zs = document.getElementById('zoomSlide'); if(zs) zs.oninput = function() { g_zoom = this.value; };
    let lx = document.getElementById('lightX'); if(lx) lx.oninput = function() { g_lightPos[0] = this.value/100; };
    let ly = document.getElementById('lightY'); if(ly) ly.oninput = function() { g_lightPos[1] = this.value/100; };
    let lz = document.getElementById('lightZ'); if(lz) lz.oninput = function() { g_lightPos[2] = this.value/100; };
    
    let updateColor = () => {
        g_lightColor[0] = document.getElementById('lightR').value / 100;
        g_lightColor[1] = document.getElementById('lightG').value / 100;
        g_lightColor[2] = document.getElementById('lightB').value / 100;
    };
    document.getElementById('lightR').oninput = updateColor;
    document.getElementById('lightG').oninput = updateColor;
    document.getElementById('lightB').oninput = updateColor;

    document.getElementById('toggleLight').onclick = function() { 
        g_lightOn = !g_lightOn;
        this.innerText = "Light: " + (g_lightOn ? "ON" : "OFF");
    };

    document.getElementById('toggleNormals').onclick = function() { 
        g_normalOn = !g_normalOn;
        this.innerText = "Normals: " + (g_normalOn ? "ON" : "OFF");
    };

    document.getElementById('toggleSpot').onclick = function() { 
        g_isSpotlightOn = !g_isSpotlightOn; 
        this.innerText = "Spotlight: " + (g_isSpotlightOn ? "ON" : "OFF");
    };

    document.getElementById('toggleAnimLight').onclick = function() { 
        g_animateLight = !g_animateLight; 
        this.innerText = "Anim Light: " + (g_animateLight ? "ON" : "OFF");
    };

    // Removed the removed controls listeners to prevent errors
    // (Head, Ears, FootL, FootR, AnimToggle)

    document.getElementById('resetButton').onclick = function() {
        g_animationOn = false; g_pokeAnimation = false; g_mag = 0;
        g_head_base = 0; g_ear_base = 0; g_footL_base = 0; g_footR_base = 0;
        g_FL_base = [0,0]; g_FR_base = [0,0]; g_BL_base = [0,0]; g_BR_base = [0,0];
        g_globalAngleX = 0; g_globalAngleY = 0; g_zoom = 0;
        g_lightPos = [0, 2.5, 2.0];
        g_normalOn = false; g_lightOn = true;
        
        document.getElementById('toggleLight').innerText = "Light: ON";
        document.getElementById('toggleNormals').innerText = "Normals: OFF";
        document.getElementById('angleX').value = 0;
        document.getElementById('angleY').value = 0;
        document.getElementById('lightX').value = 0;
        document.getElementById('lightY').value = 250;
        document.getElementById('lightZ').value = 200;
        
        const inputs = document.getElementsByTagName('input');
        for(let i=0; i<inputs.length; i++) {
            if(inputs[i].id.includes("angle") || inputs[i].id.includes("zoom") || inputs[i].id.includes("light")) continue; 
            inputs[i].value = 0;
        }
    };
    
    canvas.onmousedown = function(ev) {
        if(ev.shiftKey) { g_pokeAnimation = true; g_pokeTime = g_seconds; }
        else {
            let lastX = ev.clientX; let lastY = ev.clientY;
            canvas.onmousemove = function(e) {
                let dx = e.clientX - lastX; let dy = e.clientY - lastY;
                g_globalAngleY += dx; g_globalAngleX += dy;
                lastX = e.clientX; lastY = e.clientY;
            };
        }
    };
    canvas.onmouseup = function() { canvas.onmousemove = null; };
}