// lib/cuon-matrix-cse160.js
class Vector3 {
    constructor(opt_src) {
        var v = new Float32Array(3);
        if (opt_src && typeof opt_src === 'object') {
          v[0] = opt_src[0];
          v[1] = opt_src[1];
          v[2] = opt_src[2];
        }
        this.elements = v;
    }

    /**
     * Copy vector.
     * @param src source vector
     * @return this
     */
    set(src) {
        var s = src.elements;
        var d = this.elements;
        if (s === d) return this;
        for (var i = 0; i < 3; ++i) {
            d[i] = s[i];
        }
        return this;
    }

    /**
      * Add other to this vector.
      */
    add(other) {
        this.elements[0] += other.elements[0];
        this.elements[1] += other.elements[1];
        this.elements[2] += other.elements[2];
        return this;
    }

    /**
      * Subtract other from this vector.
      */
    sub(other) {
        this.elements[0] -= other.elements[0];
        this.elements[1] -= other.elements[1];
        this.elements[2] -= other.elements[2];
        return this;
    }

    /**
      * Divide this vector by a scalar.
      */
    div(scalar) {
        if (scalar === 0) {
            console.error("Division by zero!");
            return this;
        }
        this.elements[0] /= scalar;
        this.elements[1] /= scalar;
        this.elements[2] /= scalar;
        return this;
    }

    /**
      * Multiply this vector by a scalar.
      */
    mul(scalar) {
        this.elements[0] *= scalar;
        this.elements[1] *= scalar;
        this.elements[2] *= scalar;
        return this;
    }

    /**
      * Calculate the dot product between two vectors.
      * @return scalar
      */
    static dot(v1, v2) {
        let a = v1.elements;
        let b = v2.elements;
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }

    /**
      * Calculate the cross product between two vectors.
      * @return new Vector3
      */
    static cross(v1, v2) {
        let a = v1.elements;
        let b = v2.elements;
        let v3 = new Vector3();
        v3.elements[0] = a[1] * b[2] - a[2] * b[1];
        v3.elements[1] = a[2] * b[0] - a[0] * b[2];
        v3.elements[2] = a[0] * b[1] - a[1] * b[0];
        return v3;
    }

    /**
      * Calculate the magnitude (length) of this vector.
      */
    magnitude() {
        let e = this.elements;
        return Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
    }

    /**
      * Normalize this vector.
      */
    normalize() {
        let m = this.magnitude();
        if (m > 0) {
            this.div(m);
        }
        return this;
    }
}

// Minimal Matrix4 class to prevent errors in other scripts
class Matrix4 {
    constructor() {
        this.elements = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    }
}