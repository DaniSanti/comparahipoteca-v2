export const chooseEuriborValue = ({
  currentValue,
  officialValue,
  isSharedVariable,
  wasManuallyEdited,
}: {
  currentValue: string;
  officialValue: number;
  isSharedVariable: boolean;
  wasManuallyEdited: boolean;
}): string =>
  isSharedVariable || wasManuallyEdited ? currentValue : String(officialValue);
