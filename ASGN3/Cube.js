// Global Buffer Handles
let g_cubeBuffer = null;
let g_cubeUVBuffer = null;
let g_wedgeBuffer = null;
let g_wedgeUVBuffer = null;

// Call this once from main()
function initCubeBuffer() {
    // ================= CUBE DATA (36 Vertices) =================
    // Format: 6 faces, 2 triangles each. 
    // Vertices match the logic: Front(Z=0), Back(Z=1), etc.
    // UVs match: (0,0), (1,1), (1,0) ... to map texture to each face fully.
    
    var v = [
        // Front
        0,0,0, 1,1,0, 1,0,0,   0,0,0, 0,1,0, 1,1,0,
        // Top
        0,1,0, 0,1,1, 1,1,1,   0,1,0, 1,1,1, 1,1,0,
        // Back (Note: winding order adjusted for visibility)
        0,0,1, 1,1,1, 0,1,1,   0,0,1, 1,0,1, 1,1,1,
        // Bottom
        0,0,0, 0,0,1, 1,0,1,   0,0,0, 1,0,1, 1,0,0,
        // Left
        0,0,0, 0,1,1, 0,0,1,   0,0,0, 0,1,0, 0,1,1,
        // Right
        1,0,0, 1,1,1, 1,0,1,   1,0,0, 1,1,0, 1,1,1
    ];

    var uv = [
        // Front
        0,0, 1,1, 1,0,  0,0, 0,1, 1,1,
        // Top
        0,0, 0,1, 1,1,  0,0, 1,1, 1,0,
        // Back
        1,0, 0,1, 1,1,  1,0, 0,0, 0,1,
        // Bottom
        0,1, 0,0, 1,0,  0,1, 1,0, 1,1,
        // Left
        1,0, 0,1, 1,1,  1,0, 0,0, 0,1,
        // Right
        0,0, 1,1, 1,0,  0,0, 0,1, 1,1
    ];

    // Create Cube Buffers
    g_cubeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);

    g_cubeUVBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeUVBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);


    // ================= WEDGE DATA (Used for Bunny Neck) =================
    // Copied from previous logic, pre-packaged
    var wv = [
        0,0,0, 1,0,0, 0,1,0,  // Front
        0,0,1, 0,1,1, 1,0,1,  // Back
        0,0,0, 0,0,1, 1,0,1,  0,0,0, 1,0,1, 1,0,0, // Bottom
        0,0,0, 0,1,0, 0,1,1,  0,0,0, 0,1,1, 0,0,1, // Wall
        1,0,0, 1,0,1, 0,1,1,  1,0,0, 0,1,1, 0,1,0  // Sloped
    ];
    // Dummy UVs for wedge (just needs to be correct length)
    var wuv = [];
    for(let i=0; i<wv.length/3; i++) { wuv.push(0,0); }

    g_wedgeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_wedgeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(wv), gl.STATIC_DRAW);

    g_wedgeUVBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_wedgeUVBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(wuv), gl.STATIC_DRAW);
}

class Cube {
    constructor() {
        this.type = 'cube';
        this.color = [1.0, 1.0, 1.0, 1.0];
        this.matrix = new Matrix4();
        this.textureNum = -2; // Default to color
    }

    drawCube(shaderProgram) {
        // 1. Pass Uniforms
        gl.uniformMatrix4fv(shaderProgram.u_ModelMatrix, false, this.matrix.elements);
        gl.uniform1i(shaderProgram.u_whichTexture, this.textureNum);
        gl.uniform4f(shaderProgram.u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);

        // 2. Bind Vertex Buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeBuffer);
        gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);

        // 3. Bind UV Buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeUVBuffer);
        gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_UV);

        // 4. Draw all 36 vertices at once
        gl.drawArrays(gl.TRIANGLES, 0, 36);
    }
    
    drawWedge(shaderProgram) {
        // 1. Pass Uniforms
        gl.uniformMatrix4fv(shaderProgram.u_ModelMatrix, false, this.matrix.elements);
        gl.uniform1i(shaderProgram.u_whichTexture, this.textureNum);
        gl.uniform4f(shaderProgram.u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);

        // 2. Bind Vertex Buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, g_wedgeBuffer);
        gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);

        // 3. Bind UV Buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, g_wedgeUVBuffer);
        gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_UV);

        // 4. Draw
        // The wedge data has 8 triangles (24 vertices)
        gl.drawArrays(gl.TRIANGLES, 0, 24);
    }
}