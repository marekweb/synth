import React, { Component, useState } from "react";
import Synth, { PlayingNote } from "./synth";
import Sequencer, { ScheduledNote } from "./sequencer";
import "./index.css";
import Circle from "./circle";
import Slider from "./slider";

const defaultNoteDuration = 0.5;

const LabeledSlider: React.FunctionComponent<{
  value: number;
  onChange: (value: number, name?: string) => void;
}> = props => {
  return (
    <div>
      {props.value}
      <Slider maxValue={100} value={props.value} onChange={props.onChange} />
    </div>
  );
};

function NotesTable(props: { notes: Map<number, PlayingNote> }) {
  const notes = Array.from(props.notes.entries()).map(([key, note]) => {
    return (
      <div style={{ fontFamily: "monospace" }}>
        {key}: {note.gain.gain.value}
      </div>
    );
  });

  return <div>{notes}</div>;
}

function createScaleNotes(
  scale: string = "chromatic",
  baseNote = 60,
  numberOfNotes?: number
) {
  const intervals = scales[scale];
  if (!intervals) {
    throw new Error(`No such scale ${scale}`);
  }

  if (numberOfNotes === undefined) {
    numberOfNotes = intervals.length - 1;
  }

  const notes = [baseNote];
  let currentNote = baseNote;
  for (let i = 0; i < numberOfNotes; i++) {
    const interval = intervals[i % intervals.length];
    currentNote += interval;
    notes.push(currentNote);
  }

  return notes;
}

const scales: { [name: string]: number[] } = {
  chromatic: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  major: [2, 2, 1, 2, 2, 2, 1],
  "major-pentatonic": [2, 2, 3, 2, 3],
  minor: [2, 1, 2, 2, 1, 2, 2],
  "minor-pentatonic": [3, 2, 2, 3, 2]
};

const noteNames = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B"
];

function getNameOfMidiNote(midiNote: number) {
  return noteNames[midiNote % 12];
}

function getOctaveOfMidiNote(midiNote: number) {
  return Math.floor(midiNote / 12);
}

function getNameWithOctaveOfMidiNote(midiNote: number) {
  return `${getNameOfMidiNote(midiNote)}${getOctaveOfMidiNote(midiNote)}`;
}

function isUnison(midiNoteA: number, midiNoteB: number) {
  return (midiNoteA - midiNoteB) % 12 === 0;
}

class App extends Component<{
  synth: Synth;
  sequencer: Sequencer;
  sequence: ScheduledNote[];
  preset: string;
  onChangeSequence: (sequence: ScheduledNote[]) => void;
  onPlayPause: () => void;
  activeStep?: number;
}> {
  getNoteAtTime(midiNote: number, step: number) {
    return this.props.sequence.find(
      note => note.note === midiNote && note.time === step
    );
  }

  isUnisonNotePresent(midiNote: number, step: number) {
    return !!this.props.sequence.find(
      n => n.time === step && n.note !== midiNote && isUnison(n.note, midiNote)
    );
  }

  handleClickCell = (row: number, step: number) => {
    // Is there a note?
    const note = this.getNoteAtTime(row, step);
    if (note) {
      // delete this note;
      const noteIndex = this.props.sequence.findIndex(n => n === note);
      const newSequence = [
        ...this.props.sequence.slice(0, noteIndex),
        ...this.props.sequence.slice(noteIndex + 1)
      ];
      this.props.onChangeSequence(newSequence);
    } else {
      const newNote = { note: row, time: step };
      if (!this.props.sequencer.getPlayingState())
        this.props.synth.playNote(newNote.note, defaultNoteDuration);

      const newSequence = [...this.props.sequence, newNote];
      this.props.onChangeSequence(newSequence);
    }
  };

  getSequencerNoteRows() {
    switch (this.props.preset) {
      case "G#mP":
        return createScaleNotes("minor-pentatonic", 44, 15).reverse();

      case "CmP":
      default:
        return createScaleNotes("minor-pentatonic", 48, 25).reverse();
    }
  }

  renderMatrix() {
    const cells = createArray(16);
    // TODO: cache sequencer note rows
    return this.getSequencerNoteRows().map((rowMidiNote, rowIndex) => (
      <div style={{ display: "flex", flexAlign: "center" }}>
        <span style={{ flex: "0 0 auto", width: 48, fontSize: 10 }}>
          {rowMidiNote}
          &mdash;
          {getNameWithOctaveOfMidiNote(rowMidiNote)}
        </span>
        {cells.map(step => (
          <Cell
            dotted={this.isUnisonNotePresent(rowMidiNote, step)}
            active={step === this.props.activeStep}
            onClick={this.handleClickCell}
            row={rowMidiNote}
            step={step}
            note={this.getNoteAtTime(rowMidiNote, step)}
          />
        ))}
      </div>
    ));
  }

  handleClickClear = () => {
    this.props.onChangeSequence([]); // destructive action
  };

  getSynthParam = (name: string) => {
    return this.props.synth.getParam(name);
  };

  setSynthParam = (name: string, value: number) => {
    this.props.synth.setParam(name, value);
    this.forceUpdate();
  };

  renderParamSlider(name: string) {
    return (
      <div>
        {name}
        <LabeledSlider
          value={this.getSynthParam(name)}
          onChange={value => this.setSynthParam(name, value)}
        />
      </div>
    );
  }

  render() {
    return (
      <div>
        <Circle
          toggled={this.props.sequencer.getPlayingState()}
          onClick={this.props.onPlayPause}
        >
          ▶
        </Circle>

        <Circle onClick={this.handleClickClear}>&times;</Circle>
        {this.renderMatrix()}

        {this.renderParamSlider("vibrato-freq")}
        {this.renderParamSlider("vibrato-depth")}
        {this.renderParamSlider("filter-q")}
        {this.renderParamSlider("delay-volume")}
        {this.renderParamSlider("tremolo-freq")}
        {this.renderParamSlider("tremolo-depth")}
      </div>
    );
  }
}

function createArray(n: number) {
  const array = [];
  for (let i = 0; i < n; i++) {
    array.push(i);
  }
  return array;
}

const Cell: React.FunctionComponent<{
  row: number;
  step: number;
  dotted?: boolean;
  note?: ScheduledNote;
  onClick: (row: number, step: number) => void;
  active: boolean;
}> = props => {
  let circleLightness;
  let noteLightness = props.active ? 90 : 50;

  if (props.active) {
    circleLightness = 2;
  } else {
    if (props.step % 4 === 0) {
      circleLightness = 10;
    } else if (props.step % 2 === 0) {
      circleLightness = 7;
    } else {
      circleLightness = 5;
    }
  }

  // Full rainbow
  // const hue = props.row * 5;

  // Repeating rainbow
  const hue = (props.row % 12) * 30;

  const noteColor = `hsl(${hue}, 60%, ${noteLightness}%)`;
  const squareBg = `hsl(0, 0% 0)`;
  const circleBg = props.note ? noteColor : `hsl(0, 0%, ${circleLightness}%)`;
  const dotBg = props.dotted && !props.note ? noteColor : "transparent";
  return (
    <div
      onClick={() => props.onClick(props.row, props.step)}
      style={{
        backgroundColor: squareBg,
        flex: "0 0 auto",
        width: 16,
        height: 16,
        padding: 1
      }}
    >
      <div
        className="cell"
        style={{
          backgroundColor: circleBg,
          borderRadius: 16,
          width: 16,
          height: 16,
          padding: 6,
          boxSizing: "border-box"
        }}
      >
        <div
          style={{
            opacity: 0.5,
            backgroundColor: dotBg,
            borderRadius: 4,
            width: 4,
            height: 4
          }}
        />
      </div>
    </div>
  );
};

export default App;
