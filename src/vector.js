class Vector {
    constructor(x, y) {
        this.set(x, y);
    }

    set(x = 0, y = x) {
        this.x = x;
        this.y = y;
        return this;
    }

    from(obj) {
        this.x = obj.x;
        this.y = obj.y;
        return this;
    }

    add(vec) {
        this.x += vec.x;
        this.y += vec.y;
        return this;
    }

    sub(vec) {
        this.x -= vec.x;
        this.y -= vec.y;
        return this;
    }

    // invert() {
    //     this.x *= -1;
    //     this.y *= -1;
    //     return this;
    // }

    mul(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    div(scalar) {
        if (scalar === 0) {
            this.x = 0;
            this.y = 0;
        } else {
            this.x /= scalar;
            this.y /= scalar;
        }
        return this;
    }

    norm() {
        const length = this.length();

        if (length === 0) {
            this.x = 1;
            this.y = 0;
        } else {
            this.div(length);
        }

        return this;
    }

    rotate(angle) {
        const nx = this.x * Math.cos(angle) - this.y * Math.sin(angle);
        const ny = this.x * Math.sin(angle) + this.y * Math.cos(angle);

        this.x = nx;
        this.y = ny;

        return this;
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    distanceSq(vec) {
        const dx = this.x - vec.x;
        const dy = this.y - vec.y;
        return dx * dx + dy * dy;
    }

    // distance(vec) {
    //     return Math.sqrt(this.distanceSq(vec));
    // }

    angle() {
        return Math.atan2(this.y, this.x);
    }

    cross(vec) {
        return this.x * vec.y - this.y * vec.x;
    }

    dot(vec) {
        return this.x * vec.x + this.y * vec.y;
    }

    clone() {
        return new Vector(this.x, this.y);
    }
}

export default Vector;
