# frozen_string_literal: true

require "minitest/autorun"
require "tmpdir"
require_relative "check_workflow_security"

class WorkflowSecurityPolicyTest < Minitest::Test
  def errors_for(source)
    Dir.mktmpdir do |directory|
      path = File.join(directory, "workflow.yml")
      File.write(path, source)
      return WorkflowSecurityPolicy.new(load_workflow(path), path).check
    end
  end

  def test_current_preview_workflow_passes
    workflow = load_workflow(File.expand_path("../.github/workflows/supabase-preview.yml", __dir__))

    assert_empty WorkflowSecurityPolicy.new(workflow, "supabase-preview.yml").check
  end

  def test_rejects_secret_job_that_checks_out_pr_head_regardless_of_key_order
    errors = errors_for(<<~YAML)
      on:
        pull_request:
      jobs:
        remote-preview:
          steps:
            - with:
                ref: ${{ github.event.pull_request.head.sha }}
              uses: actions/checkout@v4
          env:
            PROVIDER_TOKEN: ${{ secrets.PROVIDER_TOKEN }}
          if: github.event_name == 'pull_request' && github.event.action != 'closed'
    YAML

    assert(errors.any? { |error| error.include?("non-closed") })
    assert(errors.any? { |error| error.include?("actions/checkout") })
    assert(errors.any? { |error| error.include?("pull-request-head-controlled") })
  end

  def test_rejects_pull_request_target_secret_job_that_checks_out_pr_head
    errors = errors_for(<<~YAML)
      on: pull_request_target
      jobs:
        remote-preview:
          env:
            PROVIDER_TOKEN: ${{ secrets.PROVIDER_TOKEN }}
          if: github.event_name == 'pull_request_target' && github.event.action != 'closed'
          steps:
            - uses: actions/checkout@v4
              with:
                ref: ${{ github.event.pull_request.head.sha }}
    YAML

    assert(errors.any? { |error| error.include?("non-closed") })
    assert(errors.any? { |error| error.include?("actions/checkout") })
    assert(errors.any? { |error| error.include?("pull-request-head-controlled") })
  end

  def test_rejects_sequence_form_pr_trigger_with_sensitive_non_closed_job
    errors = errors_for(<<~YAML)
      on: [pull_request, workflow_dispatch]
      jobs:
        remote-preview:
          env:
            PROVIDER_TOKEN: ${{ secrets.PROVIDER_TOKEN }}
          if: github.event_name == 'pull_request' && github.event.action != 'closed'
          steps:
            - uses: actions/checkout@v4
              with:
                ref: ${{ github.event.pull_request.head.sha }}
    YAML

    assert(errors.any? { |error| error.include?("non-closed") })
    assert(errors.any? { |error| error.include?("actions/checkout") })
    assert(errors.any? { |error| error.include?("pull-request-head-controlled") })
  end

  def test_rejects_generated_database_credentials_with_pr_artifact_execution
    errors = errors_for(<<~YAML)
      on:
        pull_request:
      jobs:
        remote-preview:
          environment: preview-provider
          if: github.event_name == 'pull_request' && github.event.action != 'closed'
          steps:
            - uses: actions/download-artifact@v4
            - run: GYF_DATABASE_URL="$POSTGRES_URL_NON_POOLING" ./run-migration
    YAML

    assert(errors.any? { |error| error.include?("non-closed") })
    assert(errors.any? { |error| error.include?("download-artifact") })
  end

  def test_allows_closed_pr_cleanup_without_checkout_or_head_expression
    errors = errors_for(<<~YAML)
      on:
        pull_request:
          types: [closed]
      jobs:
        cleanup:
          if: github.event_name == 'pull_request' && github.event.action == 'closed'
          environment: provider-cleanup
          env:
            PROVIDER_TOKEN: ${{ secrets.PROVIDER_TOKEN }}
            PREVIEW_BRANCH: pr-${{ github.event.pull_request.number }}
          steps:
            - uses: supabase/setup-cli@v1
            - run: supabase branches delete "$PREVIEW_BRANCH"
    YAML

    assert_empty errors
  end

  def test_allows_closed_pull_request_target_cleanup_without_checkout_or_head_expression
    errors = errors_for(<<~YAML)
      on: [workflow_dispatch, pull_request_target]
      jobs:
        cleanup:
          if: github.event_name == 'pull_request_target' && github.event.action == 'closed'
          environment: provider-cleanup
          env:
            PROVIDER_TOKEN: ${{ secrets.PROVIDER_TOKEN }}
            PREVIEW_BRANCH: pr-${{ github.event.pull_request.number }}
          steps:
            - uses: supabase/setup-cli@v1
            - run: supabase branches delete "$PREVIEW_BRANCH"
    YAML

    assert_empty errors
  end
end
