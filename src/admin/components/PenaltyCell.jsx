import React from 'react';

const PenaltyCell = ({ record }) => {
  if (Number(record.penaltyAmount) > 0) {
    return (
      <span className="penalty-pill fee" title="Penalty charged">
        PHP {Number(record.penaltyAmount).toFixed(2)}
      </span>
    );
  }
  if (Number(record.overdueDays) > 0) {
    return (
      <span className="penalty-pill late" title="Returned after due date">
        {record.overdueDays} day(s) late
      </span>
    );
  }
  return <span className="penalty-pill clear">On time</span>;
};

export default PenaltyCell;
