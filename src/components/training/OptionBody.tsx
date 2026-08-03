import { formatDuration, type ScaledOption } from "../../data/training-plan";

/**
 * One session's prescription. The layout follows the format, not the day:
 * strength gets sets and an exercise list, intervals get a work/recovery
 * headline, steady and play get a single duration.
 */
export function OptionBody({ option }: { option: ScaledOption }) {
  return (
    <>
      <ul class="tp-sports">
        {option.sports.map((sport) => (
          <li class="tp-sport" key={sport}>
            {sport}
          </li>
        ))}
      </ul>

      {option.format === "sets" && (
        <>
          <p class="tp-headline">
            <strong>
              {option.sets} &times; {option.reps}
            </strong>
            <span class="tp-headline-sub">{option.restSets} rest between sets</span>
          </p>
          <p class="tp-meta-line">
            Straight sets &middot; {option.restExercises} between exercises
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
          <ul class="tp-exercises">
            <li class="tp-exercise">
              <span class="tp-exercise-name">Warm-up</span>
              <span class="tp-exercise-reps">{option.warmup} min</span>
            </li>
            <li class="tp-exercise">
              <span class="tp-exercise-name">Cool-down</span>
              <span class="tp-exercise-reps">{option.cooldown} min</span>
            </li>
            <li class="tp-exercise tp-exercise--total">
              <span class="tp-exercise-name">Total</span>
              <span class="tp-exercise-reps">{formatDuration(option.minutes ?? 0)}</span>
            </li>
          </ul>
        </>
      )}

      {option.equipment && <p class="tp-equipment">{option.equipment}</p>}
    </>
  );
}
