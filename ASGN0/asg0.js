// asg0.js
var canvas;
var ctx;

function main() {
    canvas = document.getElementById('example');
    if (!canvas) {
        console.log('Failed to retrieve the <canvas> element ');
        return false;
    }
    ctx = canvas.getContext('2d');

    // Initial clear
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 400, 400);
}

function handleDrawEvent() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 400, 400);

    var v1x = parseFloat(document.getElementById('v1x').value) || 0;
    var v1y = parseFloat(document.getElementById('v1y').value) || 0;
    var v1 = new Vector3([v1x, v1y, 0]);
    drawVector(v1, "red");

    var v2x = parseFloat(document.getElementById('v2x').value) || 0;
    var v2y = parseFloat(document.getElementById('v2y').value) || 0;
    var v2 = new Vector3([v2x, v2y, 0]);
    drawVector(v2, "blue");
}

function handleDrawOperationEvent() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 400, 400);

    var v1x = parseFloat(document.getElementById('v1x').value) || 0;
    var v1y = parseFloat(document.getElementById('v1y').value) || 0;
    var v1 = new Vector3([v1x, v1y, 0]);
    drawVector(v1, "red");

    var v2x = parseFloat(document.getElementById('v2x').value) || 0;
    var v2y = parseFloat(document.getElementById('v2y').value) || 0;
    var v2 = new Vector3([v2x, v2y, 0]);
    drawVector(v2, "blue");

    var operation = document.getElementById('op-select').value;
    var scalar = parseFloat(document.getElementById('scalar').value) || 0;
    
    if (operation === "Add") {
        var v3 = new Vector3(v1.elements);
        v3.add(v2);
        drawVector(v3, "green");
    } 
    else if (operation === "Subtract") {
        var v3 = new Vector3(v1.elements);
        v3.sub(v2);
        drawVector(v3, "green");
    } 
    else if (operation === "Multiply") {
        var v3 = new Vector3(v1.elements).mul(scalar);
        var v4 = new Vector3(v2.elements).mul(scalar);
        drawVector(v3, "green");
        drawVector(v4, "green");
    } 
    else if (operation === "Divide") {
        var v3 = new Vector3(v1.elements).div(scalar);
        var v4 = new Vector3(v2.elements).div(scalar);
        drawVector(v3, "green");
        drawVector(v4, "green");
    }
    else if (operation === "Magnitude") {
        console.log("Magnitude v1:", v1.magnitude());
        console.log("Magnitude v2:", v2.magnitude());
    }
    else if (operation === "Normalize") {
        var v3 = new Vector3(v1.elements).normalize();
        var v4 = new Vector3(v2.elements).normalize();
        drawVector(v3, "green");
        drawVector(v4, "green");
    }
    else if (operation === "Angle Between") {
        let angle = angleBetween(v1, v2);
        console.log("Angle:", angle.toFixed(2));
    }
    else if (operation === "Area") {
        let area = areaTriangle(v1, v2);
        console.log("Area of the triangle:", area);
    }

}

// Task 7 
function angleBetween(v1, v2) {
    let dot = Vector3.dot(v1, v2);
    let mag1 = v1.magnitude();
    let mag2 = v2.magnitude();
    let cosAlpha = dot / (mag1 * mag2);
    // Clamp values for safety against precision errors
    cosAlpha = Math.min(1, Math.max(-1, cosAlpha)); 
    let alphaRad = Math.acos(cosAlpha);
    return alphaRad * (180 / Math.PI); // Convert to degrees
}

// Task 8 Helper
function areaTriangle(v1, v2) {
    let v3 = Vector3.cross(v1, v2);
    // Area of triangle is half the magnitude of the cross product
    return 0.5 * v3.magnitude();
}

function drawVector(v, color) {
    var cx = 200, cy = 200, scale = 20;
    var x = v.elements[0], y = v.elements[1];
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + x * scale, cy - y * scale);
    ctx.stroke();
}