import React from "react";

const Slider: React.FunctionComponent<{
  name?: string;
  maxValue: number;
  value: number;
  onChange: (value: number) => void;
}> = props => {
  return (
    <div
      onClick={e => props.onChange(e.clientX)}
      style={{ width: 100, height: 16, backgroundColor: "hsl(0, 0%, 10%)" }}
    >
      <div
        style={{
          backgroundColor: `hsl(${props.maxValue}, 60%, 60%)`,
          height: 16,
          width: `${(props.value / props.maxValue) * 100}%`
        }}
      />
    </div>
  );
};

Slider.defaultProps = {
  value: 0,
  maxValue: 100
};
export default React.memo(Slider);
