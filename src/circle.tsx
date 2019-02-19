import React from "react";

const Circle: React.FunctionComponent<{
  toggled?: boolean;
  onClick: () => void;
}> = props => (
  <div
    onClick={props.onClick}
    className={`Circle ${props.toggled ? "Circle--toggled" : ""}`}
  >
    {props.children}
  </div>
);

export default Circle;
