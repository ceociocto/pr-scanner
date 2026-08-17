import ora from "ora";

let spinner: ora.Ora | null = null;

/**
 * Create or update a progress spinner.
 */
export function startProgress(text: string): ora.Ora {
  if (spinner) {
    spinner.text = text;
    return spinner;
  }
  spinner = ora(text).start();
  return spinner;
}

/**
 * Update spinner text.
 */
export function updateProgress(text: string): void {
  if (spinner) {
    spinner.text = text;
  }
}

/**
 * Stop the spinner with a success message.
 */
export function succeedProgress(text?: string): void {
  if (spinner) {
    spinner.succeed(text);
    spinner = null;
  }
}

/**
 * Stop the spinner with an error message.
 */
export function failProgress(text?: string): void {
  if (spinner) {
    spinner.fail(text);
    spinner = null;
  }
}

/**
 * Stop the spinner.
 */
export function stopProgress(): void {
  if (spinner) {
    spinner.stop();
    spinner = null;
  }
}
