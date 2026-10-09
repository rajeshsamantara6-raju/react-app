import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  localStorage.clear();
});

test('renders the ResumeIQ overview and opens a new analysis', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /good morning, jordan/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /analyze a resume/i }));
  expect(screen.getByRole('heading', { name: /new analysis/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/resume text/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/job description/i)).toBeInTheDocument();
});

test('opens the public home and starts analysis from its primary action', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /resumeiq home/i }));
  expect(screen.getByRole('heading', { name: /your resume deserves to get noticed/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /check my resume/i }));
  expect(screen.getByRole('heading', { name: /new analysis/i })).toBeInTheDocument();
});

test('fills a sample job description from the analysis form', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /new analysis/i }));
  fireEvent.click(screen.getByRole('button', { name: /use sample/i }));
  expect(screen.getByLabelText(/job description/i).value.length).toBeGreaterThan(80);
});

test('submits resume text in demo mode and shows a heuristic report', async () => {
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /analyze a resume/i }));
  fireEvent.change(container.querySelector('input[type="file"]'), {
    target: { files: [new File(['resume'], 'product-resume.pdf', { type: 'application/pdf' })] },
  });
  fireEvent.change(screen.getByLabelText(/resume text/i), {
    target: { value: 'Jordan Davis jordan@example.com. Experience: Led product design and user research. Skills include Figma, prototyping, accessibility, and communication. Education: Design degree.' },
  });
  fireEvent.change(screen.getByLabelText(/job title/i), { target: { value: 'Product Designer' } });
  fireEvent.click(screen.getByRole('button', { name: /use sample/i }));
  fireEvent.click(screen.getByRole('button', { name: /analyze my resume/i }));
  await waitFor(() => expect(screen.getByText(/BROWSER DEMO/i)).toBeInTheDocument());
  expect(screen.getByRole('heading', { name: /product designer/i })).toBeInTheDocument();
  expect(screen.getByText(/not an employer ATS result/i)).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('resumeiq-history'))[0].file).toBe('Resume document');
});
