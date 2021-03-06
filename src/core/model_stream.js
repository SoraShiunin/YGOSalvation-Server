/**
 * Memory Buffer
 * @typedef DataStream
 * @type {Object}
 * @property {Function} input
 */

/**
 * Takes streamed broken up incoming data, stores it in a buffer, and as completed, returns complete messages.
 * @returns {DataStream} data stream with input method.
 */
function DataStream() {
    var memory = new Buffer([]);

    /**
     * Take in new information, see if new messages can be generated.
     * @param {Buffer} buffer new information
     * @returns {Packet[]} new information in packet form
     */
    function input(buffer) {
        var incomplete = true,
            output = [],
            recordOfBuffer,
            frameLength;

        memory = Buffer.concat([memory, buffer]);

        while (incomplete === true && memory.length > 2) {
            frameLength = memory.readUInt16LE(0);

            if ((memory.length - 2) < frameLength) {
                incomplete = false;
                continue;
            }

            recordOfBuffer = memory.slice(2).toJSON();
            recordOfBuffer.frameLength = frameLength;
            output.push(recordOfBuffer);

            if (memory.length === (frameLength + 2)) {
                memory = new Buffer([]);
                incomplete = false;
                continue;
            }

            memory = memory.slice((frameLength + 2));
        }

        return output;
    }
    return {
        input
    };
}

module.exports = DataStream;