document.addEventListener('DOMContentLoaded', function () {
    let geneticSpermObj;

    function restart() {
        if (geneticSpermObj) {
            geneticSpermObj.removeAll();
        }
        const population = document.getElementById('population').value;
        const mutationRate = document.getElementById('mutationRate').value;
        const elitism = document.getElementById('elitisism').value;
        geneticSpermObj = new GeneticSperm('#d3svg', population, mutationRate, elitism);
    }

    document.getElementById('population').addEventListener('change', restart);
    document.getElementById('mutationRate').addEventListener('change', restart);
    document.getElementById('elitisism').addEventListener('change', restart);

    document.getElementById('pause').addEventListener('click', function () {
        geneticSpermObj.pause();
    });

    document.getElementById('resume').addEventListener('click', function () {
        geneticSpermObj.resume();
    });

    restart();
});

var GeneticSperm = function (div, initPopulation, mutationRate, elitismBias) {
    var width = 800,
        height = 500;

    var targetTunnelWidth = 100;
    var n = initPopulation,
        m = 10,  // range of tail
        degrees = 180 / Math.PI;

    var MAX_COLORS = 20;
    var colors = [];

    for (var i = 0; i < MAX_COLORS; i++) {
        colors.push(getRandomColor());
    }

    var isPaused = false;
    this.pause = function () {
        isPaused = true;
    }
    this.resume = function () {
        isPaused = false;
    }

    function getInitialRandomSperm() {
        var x = Math.random() * 10 + 10, y = Math.random() * 150 + 10;

        var gene_energy = parseInt(Math.random() * 5 + 5); // food that they can carry
        var gene_tailStrength = parseInt(Math.random() * 5 + 1);

        var gene_yawProbability = 0.05; // rotation probabilty
        var gene_yawRange = 1 / (2 * Math.PI); // 90/PI = 90 degree change!

        var vy_initial = Math.random() * gene_yawRange * getOneOrNegativeOne();

        var vx = gene_tailStrength * 0.2;  // speed is faster on longer tail, and less weight
        var vy = 0; // initial angle is important too

        return {
            vx: vx,
            vy: vy,
            vy_initial: vy_initial,
            path: d3.range(m).map(function () { return [x, y]; }),
            colorid: parseInt(Math.random() * MAX_COLORS),
            count: 0,
            gene_tailStrength: gene_tailStrength,
            gene_initialEnergy: gene_energy,
            gene_energy: gene_energy,
            gene_yawProbability: gene_yawProbability,
            gene_yawRange: gene_yawRange,
            generation: 0,
            fit: 1,
            x: x,
            y: y,
        };
    }

    this.removeAll = function () {
        d3.select(div).selectAll("*").remove();
    };

    var spermatozoa = d3.range(n).map(function () {
        return getInitialRandomSperm();
    });

    var svg = d3.select(div).append("svg")
        .attr("width", width)
        .attr("height", height);

    svg.append("rect")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("fill", "black");

    var g = svg.selectAll("g")
        .data(spermatozoa)
        .enter().append("g");

    var head = g.append("ellipse")
        .attr("rx", 6.5)
        .attr("ry", 4)
        .style('fill', function (d) { return colors[d.colorid] });

    g.append("path")
        .datum(function (d) { return d.path.slice(0, 3); })
        .attr("class", "mid");

    g.append("path")
        .datum(function (d) { return d.path; })
        .attr("class", "tail");

    g.append("path") // inner wall
        .attr("d", "M0 200 L" + (width - targetTunnelWidth) + " 200 L" + (width - targetTunnelWidth) + " 200 L" + (width - targetTunnelWidth) + " 500 L 0 500");

    g.append("path") // outer wall
        .attr("d", "M0 0 L" + (width) + " 0 L" + (width) + " " + height + " L" + (width) + " " + height + " L 0 " + height);

    var info = g.append("text")
        .style("font-size", "11px")
        .style("fill", "white");

    var info2 = g.append("text")
        .style("font-size", "11px")
        .style("fill", "red");

    var infoPanel = g.append("text")
        .attr("x", "100")
        .attr("y", "350")
        .style("font-size", "24px")
        .style("fill", "white");

    var destPanel = g.append("text")
        .attr("x", width - 80)
        .attr("y", height - 10)
        .style("font-size", "14px")
        .style("fill", "white");

    var tail = g.selectAll(".mid, .tail");

    var bestFit = 9999.0;

    d3.timer(function () {
        if (isPaused) return;

        var i;
        var deadSperms = [];
        var totalFit = 0.0;

        for (i = -1; ++i < n;) {
            var s = spermatozoa[i];
            totalFit += s.fit;
            if (s.gene_energy <= 0.1) {
                deadSperms.push(s);
                continue;
            }

            var vlen = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
            var vx2 = s.vx / vlen;
            var vy2 = s.vy / vlen;

            s.vx = vx2 * s.gene_tailStrength;
            s.vy = vy2 * s.gene_tailStrength;

            if (Math.random() <= s.gene_yawProbability) {
                var theta = s.gene_yawRange * getOneOrNegativeOne();
                var new_vx = Math.cos(theta) * s.vx - Math.sin(theta) * s.vy;
                var new_vy = Math.sin(theta) * s.vx + Math.cos(theta) * s.vy;
                s.vx = new_vx;
                s.vy = new_vy;
            }

            var path = s.path,
                dx = s.vx,
                dy = s.vy;

            if (s.gene_energy < 5) {
                var sigmoidx = 3 * Math.pow((s.gene_energy / 5), 2) - 2 * Math.pow((s.gene_energy / 5), 3);
                var sigmoidy = sigmoidx;
                dx *= sigmoidx;
                dy *= sigmoidy;
            }

            var x = path[0][0] += dx,
                y = path[0][1] += dy;

            var speed = Math.sqrt(dx * dx + dy * dy),
                count = speed * 10,
                k1 = -5 - speed / 3;

            if (s.gene_energy > 0) {
                var energyUsed = Math.sqrt(speed) * 0.05 + 0.01;
                s.gene_energy -= energyUsed;
            }

            if (x < 0) s.vx = Math.abs(s.vx);
            else if (x > width) s.vx = -Math.abs(s.vx);

            if (y < 0) s.vy = Math.abs(s.vy);
            else if (y > height) s.vy = -Math.abs(s.vy);

            if (y > height - 10 && x > width - targetTunnelWidth) {
                s.gene_energy = 0;
            }

            if (x < width - targetTunnelWidth && y > 195 && y < 205) s.vy = -Math.abs(s.vy);
            else if (x < width - targetTunnelWidth && y >= 205) s.vx = Math.abs(s.vx);

            for (var j = 0; ++j < m;) {
                if (path[j]) {
                    var vx = x - path[j][0],
                        vy = y - path[j][1],
                        k2 = Math.sin(((s.count += count) + j * 3) / 300) / speed;
                    path[j][0] = (x += dx / speed * k1) - dy * k2;
                    path[j][1] = (y += dy / speed * k1) + dx * k2;
                    speed = Math.sqrt((dx = vx) * dx + (dy = vy) * dy);
                }
            }

            var dest_dx = path[0][0] - (width - targetTunnelWidth / 2);
            var dest_dy = path[0][1] - height;
            s.fit = (Math.sqrt(dest_dx * dest_dx + dest_dy * dest_dy)) / 800.0;

            if (s.fit < bestFit) bestFit = s.fit;
        }

        if (Math.random() > 0.95 && deadSperms.length >= 4) {
            var fit = 9999;
            var best_idx;

            for (i = 0; i < deadSperms.length; i++) {
                s = deadSperms[i];
                if (fit > s.fit) {
                    fit = s.fit;
                    best_idx = i;
                }
            }

            fit = 9999;
            var secondbest_idx;
            for (i = 0; i < deadSperms.length; i++) {
                if (i == best_idx) continue;
                s = deadSperms[i];
                if (fit > s.fit) {
                    fit = s.fit;
                    secondbest_idx = i;
                }
            }

            fit = -1;
            var worst_idx;
            for (i = 0; i < deadSperms.length; i++) {
                if (i == best_idx || i == secondbest_idx) continue;
                s = deadSperms[i];
                if (fit < s.fit) {
                    fit = s.fit;
                    worst_idx = i;
                }
            }

            var parent1 = deadSperms[best_idx];
            var parent2 = deadSperms[secondbest_idx];
            var child = deadSperms[worst_idx];

            child.generation++;

            function getMutation(v, constrainMin, constrainMax) {
                return constrain(constrainMin, constrainMax, v + v * (Math.random() - 0.5) * mutationRate);
            }

            if (Math.random() <= elitismBias) child.gene_tailStrength = parent1.gene_tailStrength;
            else child.gene_tailStrength = parent2.gene_tailStrength;

            if (Math.random() <= elitismBias) child.gene_initialEnergy = parent1.gene_initialEnergy;
            else child.gene_initialEnergy = parent2.gene_initialEnergy;

            if (Math.random() <= elitismBias) child.gene_yawProbability = parent1.gene_yawProbability;
            else child.gene_yawProbability = parent2.gene_yawProbability;

            if (Math.random() <= elitismBias) child.gene_yawRange = parent1.gene_yawRange;
            else child.gene_yawRange = parent2.gene_yawRange;

            if (Math.random() <= elitismBias) {
                child.vy_initial = parent1.vy_initial;
                child.vy = parent1.vy_initial;
            } else {
                child.vy_initial = parent2.vy_initial;
                child.vy = parent2.vy_initial;
            }

            child.gene_tailStrength = getMutation(child.gene_tailStrength, 1, 50);
            child.gene_initialEnergy = getMutation(child.gene_initialEnergy, 10, 25);
            child.gene_yawProbability = getMutation(child.gene_yawProbability, 0, 0.5);
            child.gene_yawRange = getMutation(child.gene_yawRange, 0.01 / (2 * Math.PI), 45 / (2 * Math.PI));
            child.vy = getMutation(child.vy, -child.gene_yawRange, child.gene_yawRange);

            var x, y;

            if (Math.random() <= elitismBias) {
                x = getMutation(parent1.x, 1, 150);
                y = getMutation(parent1.y, 1, 150);
            } else {
                x = Math.random() * 10 + 1;
                y = Math.random() * 50 + 10;
            }

            child.x = x;
            child.y = y;

            for (i = 0; i < m; i++) {
                child.path[i][0] = x;
                child.path[i][1] = y;
            }

            child.vx = child.gene_tailStrength * .2;
            child.colorid = parseInt(Math.random() * MAX_COLORS);
        }

        head.attr("transform", headTransform);
        tail.attr("d", tailPath);

        info.attr("transform", function (d) { return "translate(" + (d.path[0][0] - 10) + "," + (d.path[0][1] - 10) + ")" })
            .text(function (d) { return d.gene_tailStrength.toFixed(1) + ",(" + d.generation + ")" + d.fit.toFixed(2); });

        info2.attr("transform", function (d) { return "translate(" + (d.path[0][0]) + "," + (d.path[0][1] + 15) + ")" })
            .text(function (d) { return parseInt(d.gene_energy) });

        var avgFit = totalFit / n;
        infoPanel.text("Best Fit: " + bestFit.toFixed(2) + ", Avg Fit: " + avgFit.toFixed(2));

        destPanel.text("destination");
    });

    function getOneOrNegativeOne() {
        return Math.random() >= .5 ? 1 : -1;
    }

    function constrain(min, max, value) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    function headTransform(d) {
        return "translate(" + d.path[0] + ")rotate(" + Math.atan2(d.vy, d.vx) * degrees + ")";
    }

    function tailPath(d) {
        return "M" + d.join("L");
    }

    function getRandomColor() {
        var letters = '0123456789ABCDEF'.split('');
        var color = '#';
        for (var i = 0; i < 6; i++) {
            color += letters[Math.round(Math.random() * 15)];
        }
        return color;
    }
}
