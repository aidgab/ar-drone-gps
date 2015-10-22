/**
 * This file represents a Clever drone - it can fly smarter
 * Created by Aidar on 16.10.2015.
 */

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
            if (this._yawPidController){
                var correction=this._yawPidController.update(data.demo.rotation.yaw);
                correction=within(correction/360,-1,1);
                console.log(data.demo.rotation.yaw+' - ',correction, data.demo.batteryPercentage);
                if (correction>0){
                    client.clockwise(correction);
                }
                else {
                    client.counterClockwise(Math.abs(correction));
                }
                if (Math.abs(data.demo.rotation.yaw-this._yawPidController.target)<this._yawPrecision){
                    this.emit('yawReached', {target: this._yawPidController.target, current: data.demo.rotation.yaw});
                }
            }
        }
        catch (e){
            console.warn(e);
        }

        this.emit('navdata', data);
    };

    this._yawPidController = null;
    this._yawPrecision=1; //constant yaw orientation precision
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
 * Set desired yaw orientation by using PID control
 * @param targetYaw
 */
Drone.prototype.setYaw = function (targetYaw) {
    //todo fix hardcoded coeeficients
    this._yawPidController = new PIDController(5, 0.1, 0.0);

    this._yawPidController.setTarget(targetYaw);
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

