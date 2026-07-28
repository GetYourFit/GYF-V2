#!/usr/bin/env ruby
# frozen_string_literal: true

# Semantic policy for GitHub Actions workflows that can receive pull-request events.
# It protects the boundary between untrusted PR heads and provider/database secrets;
# it is intentionally narrower than a general action-pinning policy.
require "yaml"

class WorkflowSecurityPolicy
  SENSITIVE_NAMES = /(?:secret|token|api[_-]?key|password|database[_-]?url|postgres[_-]?url|dsn)/i
  HEAD_CONTROLLED = /github\.(?:event\.pull_request\.(?:head|title|body)|head_ref)/i
  PR_NUMBER = /github\.event\.pull_request\.number/i

  def initialize(workflow, path)
    @workflow = workflow
    @path = path
    @errors = []
  end

  def check
    return [] unless pull_request_trigger?

    jobs.each do |name, job|
      next unless sensitive?(job)

      check_sensitive_job(name, job)
    end
    @errors
  end

  private

  def jobs
    @workflow.fetch("jobs", {})
  end

  def pull_request_trigger?
    triggers = @workflow["on"] || @workflow[true]
    triggers.is_a?(Hash) && triggers.key?("pull_request")
  end

  def sensitive?(job)
    return true if job.key?("environment")

    leaves(job).any? do |value|
      value.match?(/secrets\./i) ||
        value.match?(/POSTGRES_URL_NON_POOLING/i) ||
        value.match?(/supabase\s+.*-o\s+env.*GITHUB_ENV/im)
    end
  end

  def check_sensitive_job(name, job)
    unless closed_pr_only?(job["if"])
      error(name, "can receive non-closed pull-request events with provider or database credentials")
    end

    steps(job).each do |step|
      check_step(name, step)
    end
  end

  def closed_pr_only?(condition)
    condition.is_a?(String) &&
      condition.match?(/github\.event_name\s*==\s*['"]pull_request['"]/i) &&
      condition.match?(/github\.event\.action\s*==\s*['"]closed['"]/i)
  end

  def check_step(name, step)
    uses = step["uses"].to_s
    if uses.match?(%r{\A(?:\./|actions/checkout@|actions/download-artifact@)}i)
      error(name, "uses #{uses.inspect}, which can consume pull-request-controlled code or artifacts")
    end

    [step["run"], step["with"], step["env"]].compact.each do |value|
      leaves(value).each do |leaf|
        next unless leaf.match?(HEAD_CONTROLLED)

        error(name, "interpolates a pull-request-head-controlled expression in a sensitive job")
      end
    end
  end

  def steps(job)
    job.fetch("steps", []).select { |step| step.is_a?(Hash) }
  end

  def leaves(value)
    case value
    when Hash then value.values.flat_map { |child| leaves(child) }
    when Array then value.flat_map { |child| leaves(child) }
    else [value.to_s]
    end
  end

  def error(job, detail)
    @errors << "#{@path}: job #{job}: #{detail}"
  end
end

def load_workflow(path)
  parsed = YAML.safe_load(File.read(path), aliases: false)
  raise "#{path}: workflow root must be a mapping" unless parsed.is_a?(Hash)

  parsed
rescue Psych::Exception => error
  raise "#{path}: invalid YAML: #{error.message}"
end

if $PROGRAM_NAME == __FILE__
  paths = ARGV.empty? ? Dir.glob(".github/workflows/*.{yml,yaml}") : ARGV
  errors = paths.sort.flat_map { |path| WorkflowSecurityPolicy.new(load_workflow(path), path).check }
  if errors.empty?
    puts "workflow security policy passed: sensitive PR jobs do not execute untrusted code"
  else
    warn "workflow security policy failed:"
    errors.each { |error| warn "- #{error}" }
    exit 1
  end
end
