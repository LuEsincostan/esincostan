import { formatDuration, type ScaledOption } from "../../data/training-plan";

/**
 * One session's prescription. The layout follows the format, not the day.
 *
 * The option label above already names the sport ("Rower or SkiErg"), so this
 * does not repeat it as chips — it goes straight to the numbers.
 */
export function OptionBody({ option }: { option: ScaledOption }) {
  return (
    <>
      {option.format === "sets" && (
        <>
          <p class="tp-headline">
            <strong>
              {option.sets} &times; {option.reps}
            </strong>
            <span class="tp-headline-sub">Straight sets</span>
          </p>
          <p class="tp-meta-line">
            {option.restSets} between sets &middot; {option.restExercises} between exercises
          </p>
          <ul class="tp-exercises">
            {option.exercises?.map((exercise) => (
              <li class="tp-exercise" key={exercise.name}>
                <span class="tp-exercise-name">{exercise.name}</span>
                <span class="tp-exercise-reps">{exercise.reps}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {option.format === "steady" && (
        <p class="tp-headline">
          <strong>{formatDuration(option.minutes ?? 0)}</strong>
          <span class="tp-headline-sub">{option.hr}</span>
        </p>
      )}

      {option.format === "play" && (
        <p class="tp-headline">
          <strong>{formatDuration(option.minutes ?? 0)}</strong>
          <span class="tp-headline-sub">{option.style}</span>
        </p>
      )}

      {option.format === "intervals" && (
        <>
          <p class="tp-headline">
            <strong>
              {option.sets} &times; {option.work}
            </strong>
            <span class="tp-headline-sub">{option.recovery}</span>
          </p>
          <p class="tp-meta-line">
            {option.warmup} min warm-up &middot; {option.cooldown} min cool-down &middot;{" "}
            {formatDuration(option.minutes ?? 0)} total
          </p>
        </>
      )}
    </>
  );
}
