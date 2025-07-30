import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userEmails, error } = await supabase
      .from('user_emails')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch email addresses' }, { status: 500 });
    }

    return NextResponse.json(userEmails);
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
    const { alias } = body;

    if (!alias || typeof alias !== 'string' || alias.trim().length === 0) {
      return NextResponse.json({ error: 'Alias is required' }, { status: 400 });
    }

    // Validate alias (alphanumeric and hyphens only)
    const aliasPattern = /^[a-zA-Z0-9-]+$/;
    if (!aliasPattern.test(alias)) {
      return NextResponse.json(
        { error: 'Alias can only contain letters, numbers, and hyphens' },
        { status: 400 }
      );
    }

    // Check current email count for user
    const { count: emailCount, error: countError } = await supabase
      .from('user_emails')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('is_active', true);

    if (countError) {
      console.error('Count error:', countError);
      return NextResponse.json({ error: 'Failed to check email count' }, { status: 500 });
    }

    // Limit to 5 email addresses per user
    if ((emailCount || 0) >= 5) {
      return NextResponse.json(
        { error: 'Maximum of 5 email addresses allowed per user' },
        { status: 400 }
      );
    }

    // Generate unique email address
    const { data: generatedEmail, error: generateError } = await supabase
      .rpc('generate_user_email', { 
        user_uuid: session.user.id,
        domain_suffix: process.env.EMAIL_DOMAIN || 'subtracker.app'
      });

    if (generateError) {
      console.error('Generate email error:', generateError);
      return NextResponse.json({ error: 'Failed to generate email address' }, { status: 500 });
    }

    // Create the email address record
    const { data: userEmail, error: insertError } = await supabase
      .from('user_emails')
      .insert({
        user_id: session.user.id,
        email_address: generatedEmail,
        alias: alias.trim(),
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: 'An email address with that alias already exists' },
          { status: 409 }
        );
      }
      console.error('Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create email address' }, { status: 500 });
    }

    return NextResponse.json(userEmail, { status: 201 });
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
    const { id, alias, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Email ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    
    if (alias !== undefined) {
      if (typeof alias !== 'string' || alias.trim().length === 0) {
        return NextResponse.json({ error: 'Invalid alias' }, { status: 400 });
      }
      
      const aliasPattern = /^[a-zA-Z0-9-]+$/;
      if (!aliasPattern.test(alias)) {
        return NextResponse.json(
          { error: 'Alias can only contain letters, numbers, and hyphens' },
          { status: 400 }
        );
      }
      
      updateData.alias = alias.trim();
    }

    if (is_active !== undefined) {
      updateData.is_active = Boolean(is_active);
    }

    const { data: userEmail, error } = await supabase
      .from('user_emails')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'An email address with that alias already exists' },
          { status: 409 }
        );
      }
      console.error('Update error:', error);
      return NextResponse.json({ error: 'Failed to update email address' }, { status: 500 });
    }

    if (!userEmail) {
      return NextResponse.json({ error: 'Email address not found' }, { status: 404 });
    }

    return NextResponse.json(userEmail);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Email ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('user_emails')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete email address' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Email address deleted successfully' });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}