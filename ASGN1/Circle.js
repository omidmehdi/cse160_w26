class Circle {
  constructor() {
    this.type = 'circle';
    this.position = [0.0, 0.0, 0.0];
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.size = 5.0;
    this.segments = 10;
  }

  render() {
    var xy = this.position;
    var rgba = this.color;
    var size = this.size;

    // Pass the color
    gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);

    // Size scaling
    var d = this.size / 200.0;

    // --- LOGIC FIX: Force at least 3 segments ---
    // If the slider is 0, 1, or 2, this forces it to be 3 (Triangle)
    let n = Math.max(3, this.segments);

    // Loop n times
    for (var i = 0; i < n; i++) {
        // Math for angles (using Radians like the "wanted" file)
        let angle1 = (i / n) * Math.PI * 2;
        let angle2 = ((i + 1) / n) * Math.PI * 2;

        // Calculate the two outer points
        let pt1 = [xy[0] + Math.cos(angle1) * d, xy[1] + Math.sin(angle1) * d];
        let pt2 = [xy[0] + Math.cos(angle2) * d, xy[1] + Math.sin(angle2) * d];

        // Draw one wedge of the circle using the standard function
        drawTriangle([xy[0], xy[1], pt1[0], pt1[1], pt2[0], pt2[1]]);
    }
  }
}