/**
 * This file represents a Clever drone - it can fly smarter
 * Created by Aidar on 16.10.2015.
 */

//todo fix hardcoded coeeficients
const YAW_PID_P=5;
const YAW_PID_I=0.1;
const YAW_PID_D=0;

var arDrone  = require('ar-drone');
var vincenty = require('node-vincenty');

var client = arDrone.createClient();

var util = require('util');
var PIDController = require('node-pid-controller');
var EventEmitter = require('events').EventEmitter;

client.config('general:navdata_demo', 'FALSE');

function within(x, min, max) {
    if (x < min) {
        return min;
    } else if (x > max) {
        return max;
    } else {
        return x;
    }
}

/**
 * Parameters of drone
 * @param params
 */
function Drone (params)
{
    // Initialize necessary properties from `EventEmitter` in this instance
    EventEmitter.call(this);
    //set nav data callback
    this._onNavData = function (data){
        try {
            if (this._yawPidController && this.desiredYaw){
                var currentYaw=(this.desiredYaw.mode=='magneto') ? data.magneto.heading.fusionUnwrapped : data.demo.rotation.yaw;
                var correction=this._yawPidController.update(currentYaw);
                correction=within(correction/360,-1,1);
                try{
                    console.log('Rot: '+data.demo.rotation.yaw, 'Mag: '+Math.abs(data.magneto.heading.fusionUnwrapped), data.demo.batteryPercentage);
                }
                catch (ee){
                    console.warn(ee);
                }

                if (correction>0){
                    client.clockwise(correction);
                }
                else {
                    client.counterClockwise(Math.abs(correction));
                }
                if (Math.abs(currentYaw-this._yawPidController.target)<this._yawPrecision){
                    this.emit('yawReached', {target: this.desiredYaw, current: currentYaw});
                }
            }
        }
        catch (e){
            console.warn(e);
        }

        this.emit('navdata', data);
    };

    //Object properties
    this.desiredYaw=null;
    this._yawPidController = null;
    this._yawPrecision=2; //constant yaw orientation precision
    client.on('navdata', this._onNavData.bind(this));
};

module.exports = Drone;
util.inherits(Drone, EventEmitter);
/**
 * Takeoff method
 */
Drone.prototype.takeoff = function (callback) {
    client.takeoff(callback);
};

/**
 * Land method
 */
Drone.prototype.land = function (callback) {
    client.land(callback);
};

/**
 * Emergency flag reset - possible to takeoff
 */
Drone.prototype.disableEmergency = function () {
    client.disableEmergency();
};

/**
 * Stop moving
 */
Drone.prototype.stop = function stop() {
    if (this._yawPidController){
        this._yawPidController.reset();
        this._yawPidController = null;
    }

    client.stop();
};

/**
 * Utilizes PID to set up the desired orientation
 * @param angle
 * @param mode 'gyro' | 'magneto'
 */
Drone.prototype.setDesiredYaw = function (angle, mode){
    this.desiredYaw={
        value: angle,
        mode: mode
    };

    this._yawPidController = new PIDController(YAW_PID_P, YAW_PID_I, YAW_PID_D);
    this._yawPidController.setTarget(angle);
};
/**
 * Set desired yaw orientation by using PID control
 * @param targetYaw
 */
Drone.prototype.setGyroYaw = function (targetYaw) {
    this.setDesiredYaw(targetYaw, 'gyro')
};

/**
 * Sets desire magneto yaw for PID controller
 * @param targetYaw
 */
Drone.prototype.setMagnetoYaw = function (targetYaw) {
    this.setDesiredYaw(targetYaw, 'magneto');
};

/**
 * Fly forward
 * @param speed
 */
Drone.prototype.front = function (speed) {
    client.front(speed);
};

/**
 * Fly backward
 * @param speed
 */
Drone.prototype.back = function (speed) {
    client.back(speed);
};

