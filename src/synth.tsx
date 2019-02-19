function getMidiNoteFrequency(midiNote: number): number {
  if (midiNote < 0 || midiNote > 128) {
    throw new Error("Bad midi note");
  }
  const middleAFrequency = 440;
  const middleANote = 69; //  A0
  return Math.pow(2, (midiNote - middleANote) / 12) * middleAFrequency;
}

function getSignalSource(context: AudioContext) {
  const buffer = context.createBuffer(1, 2, context.sampleRate);
  const data = buffer.getChannelData(0);
  data[0] = 1;
  data[1] = 1;

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  return source;
}

// TODO: implement interface for instruments
interface Instrument {
  noteOn(midiNote: number, t?: number, velocity?: number): number;
  noteOff(id: number, t?: number): void;
  scheduleNote(
    midiNote: number,
    startTime: number,
    endTime: number,
    velocity?: number
  ): void;
}

export interface PlayingNote {
  osc: OscillatorNode;
  gain: GainNode;
}

function createOsc(context: AudioContext) {
  const gainNode = context.createGain();
  const oscillator = context.createOscillator();
  oscillator.start();
  return {
    depth: gainNode.gain,
    freq: oscillator,
    connect(node: AudioNode) {
      gainNode.connect(node);
    }
  };
}

export interface EnvelopeParameters {
  a: number;
  d: number;
  s: number;
  r: number;
}

function applyEnvelopeStart(
  t: number,
  param: AudioParam,
  envelopeParams: EnvelopeParameters,
  max: number = 1
) {
  const { a, s, d } = envelopeParams;
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(max, t + a);
  param.linearRampToValueAtTime(s, t + a + d);
}

function applyEnvelopeEnd(
  t: number,
  param: AudioParam,
  envelopeParams: EnvelopeParameters
) {
  const { r } = envelopeParams;
  param.cancelScheduledValues(t);
  param.linearRampToValueAtTime(0, t + r);
}

export default class Synth implements Instrument {
  context: AudioContext;
  master: DynamicsCompressorNode;
  amp: GainNode;
  playingNotes = new Map<number, PlayingNote>();
  envelopeParams: EnvelopeParameters = {
    a: 0.1,
    d: 0.1,
    s: 0.8,
    r: 0.15
  };
  private params = new Map<string, number>();
  private noteIdCounter = 0;

  private vibratoOscillator: OscillatorNode;
  private tremoloOscillator: OscillatorNode;

  constructor(context: AudioContext) {
    this.context = context;
    this.amp = this.context.createGain();
    this.amp.gain.value = 1;
    this.amp.connect(this.context.destination);

    this.vibratoOscillator = this.context.createOscillator();
    this.vibratoOscillator.start();

    this.tremoloOscillator = this.context.createOscillator();
    this.tremoloOscillator.type = "sine";
    this.tremoloOscillator.start();

    this.master = this.context.createDynamicsCompressor();
    this.master.connect(this.amp);
  }

  get volume() {
    return this.amp.gain;
  }

  mute() {
    this.amp.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.1);
  }

  unMute() {
    this.amp.gain.value = 1;
  }

  getNoteId() {
    return this.noteIdCounter++;
  }

  getParam(name: string, def = 0) {
    const value = this.params.get(name);
    if (value === undefined) {
      return def;
    }
    return value;
  }

  setParam(name: string, value: number) {
    this.params.set(name, value);
    console.log("Setting params:", this.params);
  }

  playNote(midiNote: number, duration: number, velocity?: number) {
    const t = this.context.currentTime;
    this.scheduleNote(midiNote, t, t + duration, velocity);
  }

  scheduleNote(
    midiNote: number,
    startTime: number,
    endTime: number,
    velocity?: number
  ) {
    const playingNoteId = this.noteOn(midiNote, startTime, velocity);
    this.noteOff(playingNoteId, endTime);
  }

  noteOn(midiNote: number, t?: number, velocity?: number) {
    if (typeof t === "undefined") {
      t = this.context.currentTime;
    }

    const noteFrequency = getMidiNoteFrequency(midiNote);

    const volumeEnvelope = this.context.createGain();
    volumeEnvelope.gain.value = 0;
    applyEnvelopeStart(t, volumeEnvelope.gain, this.envelopeParams, velocity);

    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = noteFrequency / 2;
    // TODO: change to params that are exposed to the outside,
    // instead of having to get the value here, to allow to modify param
    // while a note is already playing
    filter.Q.value = this.getParam("filter-q", 1);

    const isDelay = true;
    if (isDelay) {
      const attenuationForDelay = this.context.createGain();
      attenuationForDelay.gain.value =
        (this.getParam("delay-volume", 0) / 100) * 0.8;

      const filterForDelay = this.context.createBiquadFilter();
      filterForDelay.type = "lowpass";
      filterForDelay.frequency.value = noteFrequency / 2;

      const delay = this.context.createDelay();
      delay.delayTime.value = 0.15; // TODO: link to step duration

      volumeEnvelope.connect(delay);
      delay.connect(filterForDelay);
      filterForDelay.connect(attenuationForDelay);
      attenuationForDelay.connect(this.master);
      attenuationForDelay.connect(delay); // cycle
    }

    const carrierOscillator = this.context.createOscillator();
    carrierOscillator.type = "sine";
    carrierOscillator.frequency.value = noteFrequency;
    // carrierOscillator.frequency.linearRampToValueAtTime(noteFrequency, t + this.envelopeParams.a);

    const enableFilter = true;
    if (enableFilter) {
      carrierOscillator.connect(filter);
      filter.connect(volumeEnvelope);
    } else {
      carrierOscillator.connect(volumeEnvelope);
    }

    carrierOscillator.start(t);

    this.vibratoOscillator.frequency.value = this.getParam("vibrato-freq"); // in Hz
    const vibratoGain = this.context.createGain();
    vibratoGain.gain.value = this.getParam("vibrato-depth"); // in cents
    vibratoGain.connect(carrierOscillator.detune);
    this.vibratoOscillator.connect(vibratoGain);

    this.tremoloOscillator.frequency.value = this.getParam("tremolo-freq"); // in Hz
    const tremoloDepth = this.context.createGain();
    tremoloDepth.gain.value = this.getParam("tremolo-depth") / 100;
    this.tremoloOscillator.connect(tremoloDepth);

    const tremolo = this.context.createGain();
    volumeEnvelope.connect(tremolo);

    tremoloDepth.connect(tremolo.gain);
    this.tremoloOscillator.connect(tremoloDepth);
    tremolo.connect(this.master);

    // volumeEnvelope.connect(this.master);

    const newPlayingNoteId = this.getNoteId();
    const playingNoteReference = {
      id: newPlayingNoteId,
      osc: carrierOscillator,
      gain: volumeEnvelope
    };
    this.playingNotes.set(newPlayingNoteId, playingNoteReference);

    return newPlayingNoteId;
  }

  noteOff(playingNoteId: number, t?: number) {
    if (typeof t === "undefined") {
      t = this.context.currentTime;
    }

    const playingNote = this.playingNotes.get(playingNoteId);
    if (!playingNote) {
      return;
    }

    applyEnvelopeEnd(t, playingNote.gain.gain, this.envelopeParams);
    // applyEnvelopeEnd(t, playingNote.osc.frequency, this.envelopeParams);
    // playingNote.osc.frequency.linearRampToValueAtTime(0, t + this.envelopeParams.r);
    playingNote.osc.stop(t + this.envelopeParams.r);

    this.playingNotes.delete(playingNoteId);
  }
}
