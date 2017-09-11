'use strict';

let v3 = twgl.v3;
let m4 = twgl.m4;

class View2D {
	constructor({xform = m4.identity(), slice_thickness = 1.0, displayWindow = 256, displayLevel = 128, study = null, width = 512, height = 512, x = 0, y = 0} = {}) {
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
		this.xform = xform.slice(); // view transformation applied after world2origin
		let s = this.study.series[seriesIndex];
		this.world2origin = s.world2voxel;
		let xf = m4.multiply(this.world2origin, this.xform);
		this.voxel2world = m4.inverse(xf);
		this.voxelDim = [s.width, s.height, s.depth];
	}

	// sets view transformation to xform. Then updates world2voxel and voxel2world
	setTransform(xform) {
		this.xform = xform;
		let xf = m4.multiply(this.world2origin, this.xform);
		this.voxel2world = m4.inverse(xf);
	}

	getWorld2Voxel() {
		let xf = m4.multiply(this.world2origin, this.xform);
		return xf;
	}

	scroll(amt) {
		//let tv = m4.transformDirection(this.voxel2world, [0, 0, 1.0]);
		let tv = [0, 0, amt];

		let oldTrans = this.xform.slice(); // save old transformation

		let tm = m4.translation(tv); // make translation vector
		m4.multiply(oldTrans, tm, this.xform); // add to this view's transformation

		let p = m4.transformPoint(this.getWorld2Voxel(), [0, 0, 0]);
		//m4.transformPoint(this.xform, p, p);
		let s = this.study.series[seriesIndex];
		console.log(this.xform);
		console.log(p);
		if (p[0] < 0 || p[1] < 0 || p[2] < 0 || p[0] > s.width || p[1] > s.height || p[2] > s.depth) {
			//m4.setTranslation(this.world2voxel, oldTrans, this.world2voxel);
			this.xform = oldTrans;
			return;
		}
		let xf = m4.multiply(this.world2origin, this.xform);
		this.voxel2world = m4.inverse(xf);
		
	}

	setSeriesIndex(ind) {
		this.seriesIndex = ind;
	}

	setShowMask(yn) {
		this.showMask = yn;
	}

}