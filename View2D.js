'use strict';

let v3 = twgl.v3;
let m4 = twgl.m4;

class View2D {
	constructor({scale = 1.0, xColor = null, yColor = null, normal = [0, 0, 1], U = [1, 0, 0], V = [0, 1, 0], slice_thickness = 1.0, displayWindow = 256, displayLevel = 128, study = null, width = 512, height = 512, x = 0, y = 0} = {}) {
		this.slice_thickness = slice_thickness;
		this.displayWindow = displayWindow;
		this.displayLevel = displayLevel;
		this.study = study;
		this.seriesIndex = 0;
		this.showMask = false;
		this.width = width;
		this.height = height;
		this.x = x;
		this.y = y;
		this.xColor = xColor;
		this.yColor = yColor;
		this.dxdy = [0, 0];
		this.angle = 0;
		this.setSeriesIndex(seriesIndex);
		this.normal = normal;
		this.U = U;
		this.V = V;
		this.d = 0;
		this.scale = scale;
	}

	translateCrosshair(dx, dy) {
		this.dxdy[0] += dx;
		this.dxdy[1] += dy;
	}

	angleBetween(v1, v2) {
		let dp = v1[0]*v2[0] + v1[1]*v2[1];
		let cp = v1[0]*v2[1] - v1[1]*v2[0];
		return Math.atan2(cp, dp);

	}		

	rotateCrosshair(p1, p2) {
		let dtheta = this.angleBetween(this.ch2origin(p1), this.ch2origin(p2));
		//console.log("dtheta: " + dtheta);
		this.angle += dtheta;
		return dtheta;
	}

	projectIntoPlane(c) {
		let ans = [];
		ans[0] = -v3.dot(c, this.U) / this.scale;
		ans[1] = -v3.dot(c, this.V) / this.scale;
		return ans;
	}

	updateCrosshairPosition(c) {
		this.dxdy = this.projectIntoPlane(c);
	}

	scroll(dz) {
		d += dz;
	}

	ch2origin(v) {
		v[0] -= this.x;
		v[1] -= this.y;

		v[0] -= this.width / 2.0;
		v[1] -= this.height / 2.0;

		v[0] += this.dxdy[0];
		v[1] += this.dxdy[1];

		return v;
	}


	overMoveCrosshair(x, y) {
		let v1 = this.ch2origin([x, y]);

		console.log("x: " + v1[0] + "\ty: " + v1[1]);

		if (v1[0] >= -15 && v1[0] < 15 && v1[1] >= -15 && v1[1] < 15) return true;
		return false;
	}

	overRotateCrosshair(x, y) {

/*
		x -= this.x;
		y -= this.y;

		x -= this.width / 2.0;
		y -= this.height / 2.0;

		x += this.dxdy[0];
		y += this.dxdy[1];*/
		let v = this.ch2origin([x, y]);

		// now rotate by angle
		let cs = Math.cos(this.angle);
		let sn = Math.sin(this.angle);

		cs = (this.angle >= 0) ? cs : -cs;
		sn = (this.angle >= 0) ? sn : -sn;

		// now we need to move x and y along the rotated axes.
		let px = v[0] * cs - v[1] * sn;
		let py = v[0] * sn + v[1] * cs;

		//console.log("angle: " + this.angle + "px: " + px + "\tpy: " + py);

		if ((px >= -15 && px < 15 && (py < -100 || py > 100)) || (py >= -15 && py < 15 && (px < -100 || px > 100))) return true;
		return false;
	}

/*
	scroll(dx, dy, dz) {
		//let tv = m4.transformDirection(this.voxel2world, [0, 0, 1.0]);
		let tv = [dx, dy, dz];

		//let oldTrans = this.xform.slice(); // save old transformation

		let tm = m4.translation(tv); // make translation vector
		m4.multiply(this.xform, tm, this.xform); // add to this view's transformation

		//let p = m4.transformPoint(this.getWorld2Voxel(), [0, 0, 0]);
		//m4.transformPoint(this.xform, p, p);
		//let s = this.study.series[seriesIndex];
		//console.log(this.xform);
		//console.log(p);
		//if (p[0] < 0 || p[1] < 0 || p[2] < 0 || p[0] > s.width || p[1] > s.height || p[2] > s.depth) {
			//m4.setTranslation(this.world2voxel, oldTrans, this.world2voxel);
		//	this.xform = oldTrans;
		//	return;
		//}
		let xf = m4.multiply(this.world2voxel, this.xform);
		this.voxel2world = m4.inverse(xf);
		
	}
*/

	setSeriesIndex(ind) {
		this.seriesIndex = ind;
		let s = this.study.series[ind];
		this.world2voxel = s.world2voxel;
		this.voxelDim = [s.width, s.height, s.depth];
	}

	setShowMask(yn) {
		this.showMask = yn;
	}
	viewportContains(x, y) {
		if (x >= this.x && x < this.x + this.width && y >= this.y && y < this.y + this.height) return true;
		return false;
	}

}