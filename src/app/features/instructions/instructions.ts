import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'combi-instructions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <article class="mx-auto max-w-2xl">
      <h1 class="font-display text-3xl font-bold tracking-tight">{{ 'howto.title' | transloco }}</h1>

      <h2 class="mt-6 text-lg font-semibold">{{ 'howto.whenTitle' | transloco }}</h2>
      <ul class="mt-2 list-disc space-y-1 ps-5 text-slate-700">
        <li [innerHTML]="'howto.when1' | transloco"></li>
        <li [innerHTML]="'howto.when2' | transloco"></li>
        <li>{{ 'howto.when3' | transloco }}</li>
      </ul>

      <h2 class="mt-6 text-lg font-semibold">{{ 'howto.predictionTitle' | transloco }}</h2>
      <p class="mt-2 text-slate-700" [innerHTML]="'howto.prediction' | transloco"></p>

      <h2 class="mt-6 text-lg font-semibold">{{ 'howto.scoringTitle' | transloco }}</h2>
      <div class="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table class="w-full text-sm">
          <tbody>
            <tr class="border-b border-slate-100">
              <td class="px-4 py-3 text-slate-700">{{ 'howto.scoreOutcome' | transloco }}</td>
              <td class="px-4 py-3 text-right">
                <span class="font-display rounded-full bg-emerald-100 px-2.5 py-0.5 text-base font-bold text-emerald-700 tabular-nums">+3</span>
              </td>
            </tr>
            <tr class="border-b border-slate-100">
              <td class="px-4 py-3 text-slate-700">{{ 'howto.scoreExact' | transloco }}</td>
              <td class="px-4 py-3 text-right">
                <span class="font-display rounded-full bg-amber-100 px-2.5 py-0.5 text-base font-bold text-amber-700 tabular-nums">{{ 'howto.scoreExactPts' | transloco }}</span>
              </td>
            </tr>
            <tr class="border-b border-slate-100">
              <td class="px-4 py-3 text-slate-700">{{ 'howto.scorePartial' | transloco }}</td>
              <td class="px-4 py-3 text-right">
                <span class="font-display rounded-full bg-slate-100 px-2.5 py-0.5 text-base font-bold text-slate-700 tabular-nums">+1</span>
              </td>
            </tr>
            <tr>
              <td class="px-4 py-3 text-slate-700">{{ 'howto.scoreAdvancer' | transloco }}</td>
              <td class="px-4 py-3 text-right">
                <span class="font-display rounded-full bg-emerald-100 px-2.5 py-0.5 text-base font-bold text-emerald-700 tabular-nums">+3</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 class="mt-6 text-lg font-semibold">{{ 'howto.tiebreakTitle' | transloco }}</h2>
      <p class="mt-2 text-slate-700" [innerHTML]="'howto.tiebreak' | transloco"></p>
    </article>
  `,
})
export class Instructions {}
