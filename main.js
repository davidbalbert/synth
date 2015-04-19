;(function () {
    "use strict";

    var BUFFER_SIZE = 4096;

    function Instrument(synth, createdBy, sampleGenerator) {
        this.createdBy = createdBy;
        this.sampleNum = 0;
        this.synth = synth;

        this.p = synth.ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);

        var self = this;

        this.p.onaudioprocess = function (e) {
            var outputBuffer = e.outputBuffer;

            for (var channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
                var outputData = outputBuffer.getChannelData(channel);

                for (var i = 0; i < outputBuffer.length; i++) {
                    self.synth.sampleNum = self.sampleNum;
                    outputData[i] = sampleGenerator();
                    self.sampleNum++;
                }
                self.sampleNum -= outputBuffer.length;
            }

            self.sampleNum += outputBuffer.length;
        };
    }

    Instrument.prototype.start = function () {
        this.p.connect(this.synth.ctx.destination);
    };

    Instrument.prototype.stop = function () {
        this.p.disconnect(this.synth.ctx.destination);
    };

    Instrument.prototype.sampleRate = function () {
        this.synth.sampleRate();
    };


    function Synth() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.inputs = {};
        this.nextInput = 0;
    }

    Synth.prototype.instrument = function(sampleGenerator) {
        var self = this;

        var instFn = function () {
            var inst = new Instrument(self, instFn, sampleGenerator)
            
            self.inputs[self.nextInput++] = inst;

            inst.start();

            return self.nextInput - 1;
        };

        return instFn;
    };

    Synth.prototype.sin = function (options) {
        var freq = options.freq;

        return Math.sin(2 * Math.PI * freq * this.sampleNum / this.sampleRate());
    };

    Synth.prototype.sampleRate = function () {
        return this.ctx.sampleRate;
    }

    Synth.prototype.stop = function (id) {
        var inst;

        if (arguments.length === 0) {
            for (var n in this.inputs) {
                this.inputs[n].stop();
            }

            // Don't reset this.nextInput. We don't ever reuse ids.
            this.inputs = {};
        } else if (typeof(id) === 'function') {
            for (var n in this.inputs) {
                inst = this.inputs[n];

                if (inst.createdBy === id) {
                    inst.stop();
                    delete this.inputs[n]
                }
            }
        } else {
            inst = this.inputs[id];

            if (inst) {
                delete this.inputs[id];
                inst.stop();
            }
        }
    };

    window.Synth = Synth;
    window.s = new Synth();

    var tonic = 440;

    var intonations = {
        equal: function(octaves, fifths, thirds) {
            var semitones = octaves * 12 + fifths * 7 + thirds * 4;
            return tonic * Math.pow(2, semitones / 12);
        },

        just: function(octaves, fifths, thirds) {
            return tonic * Math.pow(2, octaves) * Math.pow(1.5, fifths) * Math.pow(1.25, thirds);
        }
    };

    function Switchable(pitches) {
        var intonation = intonations.just;

        function freq() {
            return intonation.apply(null, arguments);
        }

        this.toggle = function() {
            if (intonation === intonations.just)
                intonation = intonations.equal;
            else
                intonation = intonations.just;
        };

        this.instrument = s.instrument(function() {
            return pitches
                     .map(function(intervals) { return s.sin({freq: freq.apply(null, intervals)}); })
                     .reduce(function(a, b) { return a + b; }, 0);
        });
    }

    window.Switchable = Switchable;

    window.foo = s.instrument(function () {
        return s.sin({freq: intonations.equal(0,0,0)}) +
               s.sin({freq: intonations.equal(0,1,0)}) +
               s.sin({freq: intonations.equal(0,0,1)});
    });
})();
