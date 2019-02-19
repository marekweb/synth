import Synth from "./synth";

const defaultNoteDuration = 0.5;

export interface ScheduledNote {
  note: number;
  time: number;
  duration?: number;
  velocity?: number;
}

export default class Sequencer {
  private context: AudioContext;
  private synth: Synth;

  private stepsPerBar: number = 16;
  private stepDuration: number = 0.4;

  private barLength: number = this.stepsPerBar * this.stepDuration;
  private scheduleAhead: number = 0.2;

  private isPlaying: boolean = false;
  private startTime: number = 0;
  private scheduledUntil: number = 0;
  private sequence: ScheduledNote[] = [];

  constructor(context: AudioContext, synth: Synth) {
    this.context = context;
    this.synth = synth;
  }

  setSequence(sequence: ScheduledNote[]) {
    this.sequence = sequence;
  }

  getSequence() {
    return this.sequence;
  }

  getPlayingState() {
    return this.isPlaying;
  }

  getActiveStep() {
    if (!this.isPlaying) {
      return;
    }
    const elapsedTime = this.context.currentTime - this.startTime;
    const barOffset = elapsedTime % this.barLength;
    return Math.floor(barOffset / this.stepDuration);
  }

  getTimedSequence() {
    return this.sequence
      .filter(note => note.time <= this.stepsPerBar - 1)
      .map(note => ({
        note: note.note,
        time: note.time * this.stepDuration,
        duration: this.stepDuration, // weird default but ok
        velocity: 1
      }));
  }

  schedule = () => {
    if (!this.isPlaying) {
      return;
    }
    const t = this.context.currentTime;
    const elapsedTime = t - this.startTime;
    const currentBarNumber = Math.floor(elapsedTime / this.barLength);
    const currentBarStartTime =
      this.startTime + currentBarNumber * this.barLength;

    const currentAbsoluteScheduleAhead = t + this.scheduleAhead;

    const timedSequence = this.getTimedSequence();

    timedSequence.forEach(note => {
      const noteAbsoluteTime = note.time + currentBarStartTime;
      if (
        noteAbsoluteTime >= this.scheduledUntil &&
        noteAbsoluteTime < currentAbsoluteScheduleAhead
      ) {
        this.synth.scheduleNote(
          note.note,
          noteAbsoluteTime,
          noteAbsoluteTime + (note.duration || defaultNoteDuration),
          note.velocity
        );
      }
    });

    if (currentAbsoluteScheduleAhead > currentBarStartTime + this.barLength) {
      timedSequence.forEach(note => {
        // TODO: cache this call to getTimedSequence()
        const noteAbsoluteTime =
          note.time + currentBarStartTime + this.barLength;
        if (
          noteAbsoluteTime >= this.scheduledUntil &&
          noteAbsoluteTime < currentAbsoluteScheduleAhead
        ) {
          this.synth.scheduleNote(
            note.note,
            noteAbsoluteTime,
            noteAbsoluteTime + (note.duration || defaultNoteDuration)
          );
        }
      });
    }

    this.scheduledUntil = currentAbsoluteScheduleAhead;
    setTimeout(this.schedule, 100);
  };

  start() {
    this.context.resume();
    this.isPlaying = true;
    this.startTime = this.context.currentTime;
    this.scheduledUntil = 0;
    this.schedule();
    this.synth.unMute();
  }

  stop() {
    this.isPlaying = false;
    this.synth.mute();
  }

  toggle() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
  }
}
