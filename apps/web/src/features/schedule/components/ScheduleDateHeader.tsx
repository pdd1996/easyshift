import {
  getCalendarDayHint,
  getCalendarDayLabel,
  type CalendarDayHint,
} from '@easyshift/shared-types';
import { Tag } from 'antd';
import { formatWeekdayLabel } from '../utils';

function tagColor(hint: CalendarDayHint): string {
  switch (hint.type) {
    case 'holiday':
      return 'orange';
    case 'weekend':
      return 'red';
    case 'compensatory_work':
      return 'blue';
  }
}

function headerToneClass(hint: CalendarDayHint | null): string {
  if (!hint) {
    return 'bg-gray-50 text-gray-600';
  }

  switch (hint.type) {
    case 'holiday':
      return 'bg-amber-50 text-amber-900';
    case 'weekend':
      return 'bg-rose-50/80 text-rose-700';
    case 'compensatory_work':
      return 'bg-slate-50 text-slate-700';
  }
}

interface ScheduleDateHeaderProps {
  workDate: string;
}

export function ScheduleDateHeader({ workDate }: ScheduleDateHeaderProps) {
  const hint = getCalendarDayHint(workDate);

  return (
    <th
      className={`sticky top-0 z-20 min-w-24 border-r border-gray-100 px-2 py-2 text-center font-medium last:border-r-0 ${headerToneClass(hint)}`}
    >
      <div>{formatWeekdayLabel(workDate)}</div>
      <div className={`text-xs font-normal ${hint ? 'opacity-80' : 'text-gray-400'}`}>
        {workDate.slice(5).replace('-', '/')}
      </div>
      {hint && (
        <Tag
          className="!mt-0.5 !px-1 !text-[10px] !leading-4"
          color={tagColor(hint)}
          bordered={false}
        >
          {getCalendarDayLabel(hint)}
        </Tag>
      )}
    </th>
  );
}
