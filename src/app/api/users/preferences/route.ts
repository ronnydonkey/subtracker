import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { userPreferencesSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
    }

    // If no preferences found, return defaults
    const defaultPreferences = {
      email_notifications: true,
      notification_days_before: 7,
      currency: 'USD',
      timezone: 'UTC',
      email_forwarding: true,
      auto_detection: true,
      forward_to_email: session.user.email || '',
      // New notification settings
      monthly_budget_limit: null,
      budget_alert_enabled: true,
      budget_alert_threshold: 80,
      trial_ending_days_notice: 3,
      payment_upcoming_days_notice: 2,
      cancellation_reminder_days: 30,
      email_notifications_enabled: true,
      push_notifications_enabled: false,
      weekly_summary_enabled: true,
    };

    return NextResponse.json(preferences || defaultPreferences);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const preferencesData = {
      user_id: session.user.id,
      monthly_budget_limit: body.monthly_budget_limit || null,
      budget_alert_enabled: body.budget_alert_enabled ?? true,
      budget_alert_threshold: body.budget_alert_threshold || 80,
      trial_ending_days_notice: body.trial_ending_days_notice || 3,
      payment_upcoming_days_notice: body.payment_upcoming_days_notice || 2,
      cancellation_reminder_days: body.cancellation_reminder_days || 30,
      email_notifications_enabled: body.email_notifications_enabled ?? true,
      push_notifications_enabled: body.push_notifications_enabled ?? false,
      weekly_summary_enabled: body.weekly_summary_enabled ?? true,
      // Legacy fields
      email_notifications: body.email_notifications ?? true,
      notification_days_before: body.notification_days_before || 7,
      currency: body.currency || 'USD',
      timezone: body.timezone || 'UTC',
      email_forwarding: body.email_forwarding ?? true,
      auto_detection: body.auto_detection ?? true,
      forward_to_email: body.forward_to_email || session.user.email || '',
    };

    // Upsert preferences
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(preferencesData, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate the request body (partial update allowed)
    const updateData: any = {};
    
    if (body.email_notifications !== undefined) {
      updateData.email_notifications = Boolean(body.email_notifications);
    }
    
    if (body.notification_days_before !== undefined) {
      const days = parseInt(body.notification_days_before);
      if (isNaN(days) || days < 0 || days > 30) {
        return NextResponse.json(
          { error: 'Notification days must be between 0 and 30' },
          { status: 400 }
        );
      }
      updateData.notification_days_before = days;
    }
    
    if (body.currency !== undefined) {
      if (typeof body.currency !== 'string' || body.currency.length !== 3) {
        return NextResponse.json(
          { error: 'Currency must be a 3-character code' },
          { status: 400 }
        );
      }
      updateData.currency = body.currency.toUpperCase();
    }
    
    if (body.timezone !== undefined) {
      if (typeof body.timezone !== 'string') {
        return NextResponse.json(
          { error: 'Timezone must be a string' },
          { status: 400 }
        );
      }
      updateData.timezone = body.timezone;
    }
    
    if (body.email_forwarding !== undefined) {
      updateData.email_forwarding = Boolean(body.email_forwarding);
    }
    
    if (body.auto_detection !== undefined) {
      updateData.auto_detection = Boolean(body.auto_detection);
    }
    
    if (body.forward_to_email !== undefined) {
      if (body.forward_to_email && typeof body.forward_to_email === 'string') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.forward_to_email)) {
          return NextResponse.json(
            { error: 'Invalid email address' },
            { status: 400 }
          );
        }
      }
      updateData.forward_to_email = body.forward_to_email || null;
    }

    // Try to update existing preferences
    const { data: updatedPreferences, error: updateError } = await supabase
      .from('user_preferences')
      .update(updateData)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (updateError && updateError.code === 'PGRST116') {
      // No existing preferences, create new ones
      const newPreferences = {
        user_id: session.user.id,
        email_notifications: true,
        notification_days_before: 7,
        currency: 'USD',
        timezone: 'UTC',
        email_forwarding: true,
        auto_detection: true,
        forward_to_email: session.user.email || '',
        ...updateData,
      };

      const { data: createdPreferences, error: createError } = await supabase
        .from('user_preferences')
        .insert(newPreferences)
        .select()
        .single();

      if (createError) {
        console.error('Create error:', createError);
        return NextResponse.json({ error: 'Failed to create preferences' }, { status: 500 });
      }

      return NextResponse.json(createdPreferences);
    } else if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    return NextResponse.json(updatedPreferences);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}