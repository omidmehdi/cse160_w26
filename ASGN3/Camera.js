// =====================================================================
// HELPER METHODS: Add these to Vector3 for easier math
// =====================================================================
Vector3.prototype.set = function(v) {
    this.elements[0] = v.elements[0];
    this.elements[1] = v.elements[1];
    this.elements[2] = v.elements[2];
    return this;
};

Vector3.prototype.add = function(v) {
    this.elements[0] += v.elements[0];
    this.elements[1] += v.elements[1];
    this.elements[2] += v.elements[2];
    return this;
};

Vector3.prototype.sub = function(v) {
    this.elements[0] -= v.elements[0];
    this.elements[1] -= v.elements[1];
    this.elements[2] -= v.elements[2];
    return this;
};

Vector3.prototype.mul = function(s) {
    this.elements[0] *= s;
    this.elements[1] *= s;
    this.elements[2] *= s;
    return this;
};

// =====================================================================
// CAMERA CLASS
// =====================================================================
class Camera {
    constructor() {
        this.fov = 60.0;
        this.eye = new Vector3([0, 1, 3]);
        this.at = new Vector3([0, 0, -100]);
        this.up = new Vector3([0, 1, 0]);

        this.viewMatrix = new Matrix4();
        this.projectionMatrix = new Matrix4();
        
        this.speed = 0.5;
        this.alpha = 5; 
    }

    updateMatrix() {
        this.viewMatrix.setLookAt(
            this.eye.elements[0], this.eye.elements[1], this.eye.elements[2],
            this.at.elements[0], this.at.elements[1], this.at.elements[2],
            this.up.elements[0], this.up.elements[1], this.up.elements[2]
        );
        this.projectionMatrix.setPerspective(this.fov, 1, 0.1, 1000);
    }

    moveForward() {
        let f = new Vector3();
        f.set(this.at); 
        f.sub(this.eye); 
        f.normalize(); 
        f.mul(this.speed);
        this.eye.add(f); 
        this.at.add(f);
    }

    moveBackwards() {
        let b = new Vector3();
        b.set(this.eye); 
        b.sub(this.at); 
        b.normalize(); 
        b.mul(this.speed);
        this.eye.add(b); 
        this.at.add(b);
    }

    moveLeft() {
        // Compute Forward Vector (at - eye)
        let fx = this.at.elements[0] - this.eye.elements[0];
        let fy = this.at.elements[1] - this.eye.elements[1];
        let fz = this.at.elements[2] - this.eye.elements[2];

        // Compute Up Vector
        let ux = this.up.elements[0];
        let uy = this.up.elements[1];
        let uz = this.up.elements[2];

        // Cross Product: Side = Up x Forward
        let sx = uy * fz - uz * fy;
        let sy = uz * fx - ux * fz;
        let sz = ux * fy - uy * fx;

        // Normalize
        let len = Math.sqrt(sx*sx + sy*sy + sz*sz);
        if (len == 0) return;
        sx /= len; sy /= len; sz /= len;

        // Scale by Speed
        sx *= this.speed; sy *= this.speed; sz *= this.speed;

        // Apply
        this.eye.elements[0] += sx;
        this.eye.elements[1] += sy;
        this.eye.elements[2] += sz;
        this.at.elements[0]   += sx;
        this.at.elements[1]   += sy;
        this.at.elements[2]   += sz;
    }

    moveRight() {
        // Compute Forward Vector (at - eye)
        let fx = this.at.elements[0] - this.eye.elements[0];
        let fy = this.at.elements[1] - this.eye.elements[1];
        let fz = this.at.elements[2] - this.eye.elements[2];

        // Compute Up Vector
        let ux = this.up.elements[0];
        let uy = this.up.elements[1];
        let uz = this.up.elements[2];

        // Cross Product: Side = Forward x Up
        let sx = fy * uz - fz * uy;
        let sy = fz * ux - fx * uz;
        let sz = fx * uy - fy * ux;

        // Normalize
        let len = Math.sqrt(sx*sx + sy*sy + sz*sz);
        if (len == 0) return;
        sx /= len; sy /= len; sz /= len;

        // Scale by Speed
        sx *= this.speed; sy *= this.speed; sz *= this.speed;

        // Apply
        this.eye.elements[0] += sx;
        this.eye.elements[1] += sy;
        this.eye.elements[2] += sz;
        this.at.elements[0]   += sx;
        this.at.elements[1]   += sy;
        this.at.elements[2]   += sz;
    }

    panLeft() {
        this.pan(this.alpha);
    }

    panRight() {
        this.pan(-this.alpha);
    }
    
    pan(degrees) {
        let f = new Vector3();
        f.set(this.at); 
        f.sub(this.eye);
        
        let rotationMatrix = new Matrix4();
        rotationMatrix.setRotate(degrees, this.up.elements[0], this.up.elements[1], this.up.elements[2]);
        
        let f_prime = rotationMatrix.multiplyVector3(f);
        
        let tempEye = new Vector3();
        tempEye.set(this.eye);
        tempEye.add(f_prime);
        this.at.set(tempEye);
    }
}