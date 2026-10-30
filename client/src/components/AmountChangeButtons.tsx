import { IonButton, IonIcon } from '@ionic/react';
import { chevronDown, chevronUp } from 'ionicons/icons';
import React, { useCallback, useEffect, useRef } from 'react';
import './AmountChangeButtons.css';

const MIN_AMOUNT = 0;
const MAX_AMOUNT = 9999;
const HOLD_DELAY_MS = 400;
const START_INTERVAL_MS = 400;
const MIN_INTERVAL_MS = 100;
const INTERVAL_FACTOR = 0.85;

// the steps get coarser as the amount grows:
// 0-20 by 1, 20-30 by 5, 30-100 by 10, 100-200 by 25, 200-300 by 50, above by 100
export function getAmountStep(amount: number): number {
  if (amount < 20) {return 1;}
  if (amount < 30) {return 5;}
  if (amount < 100) {return 10;}
  if (amount < 200) {return 25;}
  if (amount < 300) {return 50;}
  return 100;
}

export function changeAmount(amount: number, direction: 1 | -1): number {
  let newAmount: number;
  if (direction === 1) {
    const step = getAmountStep(amount);
    newAmount = Math.floor(amount / step) * step + step;
  } else {
    // going down, the step of the next lower number applies
    const step = getAmountStep(amount - 1);
    newAmount = Math.ceil(amount / step) * step - step;
  }
  return Math.min(MAX_AMOUNT, Math.max(MIN_AMOUNT, newAmount));
}

interface AmountChangeButtonsProps {
  amount: number,
  onChange: (newAmount: number) => void,  // called for every step, including while holding
  onCommit: (newAmount: number) => void   // called once when the press ends
}

const AmountChangeButtons: React.FC<AmountChangeButtonsProps> = ({amount, onChange, onCommit}) => {
  const amountRef = useRef(amount);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changed = useRef(false);
  const holding = useRef(false);

  // while a press is in progress the value is driven by the steps, not by props
  useEffect(() => {
    if (!holding.current) {amountRef.current = amount;}
  },[amount]);

  const step = useCallback((direction: 1 | -1) => {
    const newAmount = changeAmount(amountRef.current, direction);
    if (newAmount === amountRef.current) {return false;}
    amountRef.current = newAmount;
    changed.current = true;
    onChange(newAmount);
    return true;
  },[onChange]);

  const stop = useCallback(() => {
    if (holdTimer.current !== null) {clearTimeout(holdTimer.current); holdTimer.current = null;}
    if (!holding.current) {return;}
    holding.current = false;
    if (changed.current) {
      changed.current = false;
      onCommit(amountRef.current);
    }
  },[onCommit]);

  const start = useCallback((direction: 1 | -1) => {
    if (holding.current) {return;}
    holding.current = true;
    changed.current = false;
    step(direction);
    let interval = START_INTERVAL_MS;
    const repeat = () => {
      if (!step(direction)) {return;} // reached the limit, nothing more to do until released
      interval = Math.max(MIN_INTERVAL_MS, interval * INTERVAL_FACTOR);
      holdTimer.current = setTimeout(repeat, interval);
    };
    holdTimer.current = setTimeout(repeat, HOLD_DELAY_MS);
  },[step]);

  useEffect(() => () => {
    if (holdTimer.current !== null) {clearTimeout(holdTimer.current);}
  },[]);

  const handlers = (direction: 1 | -1) => ({
    onPointerDown: (e: React.PointerEvent) => {e.preventDefault(); start(direction);},
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault()
  });

  return (
    // presses on the buttons must not reach the clickable row
    <div className="amount-change-buttons" slot="end" onClick={(e) => {e.preventDefault(); e.stopPropagation();}}>
      <IonButton fill="clear" size="small" className="amount-change-button" aria-label="decrease" {...handlers(-1)}>
        <IonIcon slot="icon-only" icon={chevronDown} />
      </IonButton>
      <IonButton fill="clear" size="small" className="amount-change-button" aria-label="increase" {...handlers(1)}>
        <IonIcon slot="icon-only" icon={chevronUp} />
      </IonButton>
    </div>
  );
}

export default AmountChangeButtons;
