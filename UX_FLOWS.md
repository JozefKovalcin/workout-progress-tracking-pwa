# UX_FLOWS.md

## Daily logging flow

Goal:
User should save today's core data quickly and confidently.

Primary fields:

* body weight,
* waist,
* calories,
* sleep score,
* readiness score,
* training quality score on training days.

UX requirements:

* show today's target calories/macros clearly,
* show whether today is training/rest day,
* allow switching day type,
* allow copying previous day calories,
* use steppers for frequent numeric edits,
* show missing data/completeness,
* show clear save success/error message.

Success state:

* user knows the day was saved,
* user knows whether the 14-day block has enough data,
* user can move to training quickly if today is a training day.

## Training logging flow

Goal:
User should know before saving whether the set is an improvement.

Primary fields:

* exercise,
* weight,
* reps,
* RIR.

UX requirements:

* show selected exercise clearly,
* show previous best and second best top set,
* show live e1RM,
* show live delta versus previous best,
* make PR/new-best state visually obvious,
* after saving, show clear status.

Success states:

* new PR,
* improvement,
* similar performance,
* performance drop,
* not enough comparison data.

## Progress flow

Goal:
User should understand trend direction without overthinking.

Primary views:

* body weight trend,
* waist trend,
* calories/adherence,
* strength trend.

UX requirements:

* important values must be large,
* trend color must reflect meaning,
* charts must have readable labels,
* selected data point should show exact value,
* empty states should explain what data is missing.

## Settings flow

Goal:
User should manage setup without accidental destructive changes.

Settings sections:

* Profile,
* Exercises,
* Training week,
* Data,
* Cloud/demo state.

UX requirements:

* destructive actions require confirmation,
* archived exercises should be understandable,
* export/import actions should explain scope,
* cloud mode should not allow unsafe bulk overwrite unless explicitly designed and tested.
